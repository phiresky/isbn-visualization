#[global_allocator]
// better performance than the default malloc
static ALLOC: snmalloc_rs::SnMalloc = snmalloc_rs::SnMalloc;
use crossbeam_channel::{bounded, Sender};
use humansize::{format_size, BINARY};
use parking_lot::Mutex as PLMutex;
use rusqlite::{params, Connection};
use serde::Deserialize;
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};
use zstd::Decoder;

const CHANNEL_BATCH_SIZE: usize = 10000;

// Type aliases
type OclcIdNumeric = u64;
type Isbn = String;

// Enum to represent the different metadata types
#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
enum RawRecord {
    #[serde(rename = "title_json")]
    TitleJson { record: TitleRecord },
    #[serde(rename = "search_holdings_summary_all_editions")]
    SearchHoldings {
        // oclc_number: String,
        // from_filenames: Vec<String>,
        record: HoldingsRecord,
    },

    #[serde(untagged)]
    Other {},
}

#[derive(Deserialize, Debug)]
struct TitleRecord {
    #[serde(rename = "oclcNumber")]
    oclc_number: String,
    title: Option<String>,
    creator: Option<String>,
    //#[serde(rename = "totalEditions")]
    //total_editions: u32,
    // isbn13: Option<String>,
    isbns: Vec<Isbn>,
    #[serde(rename = "machineReadableDate")]
    machine_readable_date: Option<String>,
    date: Option<String>,
    #[serde(rename = "publicationDate")]
    publication_date: Option<String>,
}

#[derive(Deserialize, Debug)]
struct HoldingsRecord {
    oclc_number: OclcIdNumeric,
    total_holding_count: u32,
    total_editions: u32,
}

#[derive(Deserialize, Debug)]
struct JsonRecord {
    metadata: RawRecord,
}

// Result type for parsed records
#[derive(Debug)]
enum ParsedRecord {
    Title {
        oclc_num: OclcIdNumeric,
        title: Option<String>,
        creator: Option<String>,
        isbn: Vec<i64>,
        publication_date: Option<i64>,
    },
    Holdings {
        oclc_num: OclcIdNumeric,
        holdings: (u32, u32),
    },
}

fn format_si_number(num: u64) -> String {
    format_size(num, BINARY)
}

struct ZstdStreamWithProgress<R: io::Read> {
    reader: R,
    bytes_read: u64,
    bytes_read_last: u64,
    total_size: u64,
    last_update: Instant,
}

impl<R: io::Read> ZstdStreamWithProgress<R> {
    fn new(reader: R, total_size: u64) -> Self {
        Self {
            reader,
            bytes_read: 0,
            bytes_read_last: 0,
            total_size,
            last_update: Instant::now(),
        }
    }
}

impl<R: io::Read> io::Read for ZstdStreamWithProgress<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let bytes = self.reader.read(buf)?;
        self.bytes_read += bytes as u64;

        if self.last_update.elapsed() >= Duration::from_secs(1) {
            eprintln!(
                "read {} / {} ({:.2}%, {}/s)",
                format_si_number(self.bytes_read),
                format_si_number(self.total_size),
                (self.bytes_read as f64 / self.total_size as f64) * 100.0,
                format_si_number(
                    (self.bytes_read - self.bytes_read_last) / self.last_update.elapsed().as_secs()
                )
            );
            self.last_update = Instant::now();
            self.bytes_read_last = self.bytes_read;
        }

        Ok(bytes)
    }
}

fn process_batch(lines: Vec<String>, record_count: u64) -> Vec<ParsedRecord> {
    lines
        .into_iter()
        .enumerate()
        .flat_map(|(i, line)| {
            let mut json_buffer = line.into_bytes();
            let record: JsonRecord = match simd_json::serde::from_slice(&mut json_buffer) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!(
                        "Error parsing JSON at record {}: {}",
                        record_count + i as u64,
                        e
                    );
                    return vec![];
                }
            };

            match record.metadata {
                RawRecord::TitleJson { record } => {
                    if let Ok(oclc_num) = record.oclc_number.parse() {
                        return vec![ParsedRecord::Title {
                            oclc_num,
                            isbn: record
                                .isbns
                                .iter()
                                .filter_map(|isbn| {
                                    let int: i64 = isbn.parse().ok()?;
                                    if int < 978_000_000_000_0 || int >= 980_000_000_000_0 {
                                        return None;
                                    }
                                    Some(int)
                                })
                                .collect(),
                            publication_date: parse_publication_date(&record),
                            title: record.title,
                            creator: record.creator,
                        }];
                    }
                }
                RawRecord::SearchHoldings { record, .. } => {
                    return vec![ParsedRecord::Holdings {
                        oclc_num: record.oclc_number,
                        holdings: (record.total_holding_count, record.total_editions),
                    }];
                }
                _ => {}
            }
            vec![]
        })
        .collect()
}

// try each of the three date fields in order (machineReadableDate, publicationDate, date), parse them with the regex ".*\b([12]\d\d\d)\b.*", fall back to next if regex fails
fn parse_single_date(date: &str) -> Option<i64> {
    static RE: LazyLock<regex::Regex> =
        LazyLock::new(|| regex::Regex::new(r".*\b([12]\d\d\d)\b.*").unwrap());

    RE.captures(date)
        .and_then(|cap| cap.get(1))
        .and_then(|m| m.as_str().parse().ok())
}
fn parse_publication_date(record: &TitleRecord) -> Option<i64> {
    record
        .machine_readable_date
        .as_ref()
        .and_then(|date| parse_single_date(date))
        .or_else(|| {
            record
                .publication_date
                .as_ref()
                .and_then(|date| parse_single_date(date))
        })
        .or_else(|| {
            record
                .date
                .as_ref()
                .and_then(|date| parse_single_date(date))
        })
}

fn reader_thread(reader: impl BufRead, sender: Sender<Vec<String>>) -> io::Result<()> {
    let mut batch = Vec::with_capacity(CHANNEL_BATCH_SIZE);
    for line in reader.lines() {
        batch.push(line?);

        if batch.len() >= CHANNEL_BATCH_SIZE {
            let mut new_batch = Vec::with_capacity(CHANNEL_BATCH_SIZE);
            std::mem::swap(&mut batch, &mut new_batch);
            sender
                .send(new_batch)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        }
    }

    // Send the final batch if it's not empty
    if !batch.is_empty() {
        let _ = sender.send(batch);
    }

    Ok(())
}

fn setup_database(conn: &Connection) -> rusqlite::Result<()> {
    // performance pragmas
    conn.execute_batch("PRAGMA synchronous = OFF")?;
    conn.execute_batch("PRAGMA journal_mode = WAL")?;
    conn.execute_batch("PRAGMA cache_size = 100000")?;
    conn.execute_batch("PRAGMA temp_store = MEMORY")?;
    conn.execute_batch("PRAGMA mmap_size = 30000000000")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS isbn_data (
            oclc_number INTEGER NOT NULL,
            isbn13 INTEGER NOT NULL,
            publication_date INTEGER,
            title TEXT,
            creator TEXT,
            PRIMARY KEY (oclc_number, isbn13)
        );
        CREATE INDEX IF NOT EXISTS isbn_oclc_number ON isbn_data (isbn13);
        ",
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS holdings_data (
            oclc_number INTEGER PRIMARY KEY,
            holding_count INTEGER NOT NULL,
            edition_count INTEGER NOT NULL
        )",
        [],
    )?;

    Ok(())
}

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let fname = args.get(1).expect("no input filename provided");

    // Initialize SQLite database
    let conn = Connection::open("../../data/library_holding_data.sqlite3")
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    setup_database(&conn).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

    let file = File::open(fname)?;
    let file_size = file.metadata()?.len();

    let progress_reader = ZstdStreamWithProgress::new(file, file_size);
    let decoder = Decoder::new(progress_reader)?;
    let reader = BufReader::new(decoder);

    // Shared database connection
    let db = Arc::new(PLMutex::new(conn));
    let record_count = Arc::new(PLMutex::new(0u64));

    let parser_threads: usize = num_cpus::get();
    // Channel for passing batches of lines
    let (sender, receiver) = bounded(parser_threads * 4);

    // Spawn reader thread
    let reader_handle = std::thread::spawn(move || reader_thread(reader, sender));

    // Process batches in parallel
    let processing_threads: Vec<_> = (0..parser_threads)
        .map(|_| {
            let receiver = receiver.clone();
            let db = Arc::clone(&db);
            let record_count = Arc::clone(&record_count);

            std::thread::spawn(move || {
                while let Ok(batch) = receiver.recv() {
                    let current_count = {
                        let mut count = record_count.lock();
                        *count += batch.len() as u64;
                        *count
                    };

                    if current_count % 1000000 < CHANNEL_BATCH_SIZE as u64 {
                        println!(
                            "{} records... {{ memory: {} }}",
                            current_count,
                            format_si_number(get_memory_usage())
                        );
                    }

                    let parsed_records = process_batch(batch, current_count);
                    store_to_db(&db, parsed_records).unwrap();
                }
            })
        })
        .collect();

    // Wait for reader to finish
    reader_handle.join().expect("Reader thread panicked")?;

    // Wait for all processing threads to finish
    for handle in processing_threads {
        handle.join().expect("Processing thread panicked");
    }

    Ok(())
}

fn store_to_db(
    db: &Arc<PLMutex<Connection>>,
    records: Vec<ParsedRecord>,
) -> Result<(), rusqlite::Error> {
    let mut db = db.lock();
    let tx = db.transaction().unwrap();

    for record in records {
        match record {
            ParsedRecord::Title {
                oclc_num,
                isbn,
                publication_date,
                title,
                creator,
            } => {
                for isbn in isbn {
                    tx.prepare_cached(
                        "INSERT OR IGNORE INTO isbn_data (oclc_number, isbn13, publication_date, title, creator) VALUES (?1, ?2, ?3, ?4, ?5)",
                    )?
                    .execute(params![oclc_num, isbn, publication_date, title, creator])?;
                }
            }
            ParsedRecord::Holdings { oclc_num, holdings } => {
                tx.prepare_cached(
                    "INSERT OR IGNORE INTO holdings_data (oclc_number, holding_count, edition_count) VALUES (?1, ?2, ?3)")?.execute(
                    params![oclc_num, holdings.0 as i64, holdings.1 as i64],
                    )?;
            }
        }
    }
    tx.commit().unwrap();

    Ok(())
}

fn get_memory_usage() -> u64 {
    memory_stats::memory_stats()
        .map(|e| e.physical_mem as u64)
        .unwrap_or(0)
}
