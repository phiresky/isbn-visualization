import { IsbnStrWithChecksum } from "./util";

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
  totalItems: number;
}
export interface GoogleBooksItem {
  kind: string;
  id: string;
  etag: string;
  selfLink: string;
  volumeInfo: Partial<{
    title: string;
    authors: string[];
    industryIdentifiers: (
      | {
          type: "ISBN_10";
          identifier: string;
        }
      | {
          type: "ISBN_13";
          identifier: IsbnStrWithChecksum;
        }
    )[];
    publisher: string;
    publishedDate: string;
    description: string;
    readingModes: {
      text: boolean;
      image: boolean;
    };
    pageCount: number;
    printType: string;
    categories: string[];
    averageRating: number;
    ratingsCount: number;
    maturityRating: string;
    allowAnonLogging: boolean;
    contentVersion: string;
    panelizationSummary: {
      containsEpubBubbles: boolean;
      containsImageBubbles: boolean;
    };
    imageLinks: {
      smallThumbnail: string;
      thumbnail: string;
    };
    language: string;
    previewLink: string;
    infoLink: string;
    canonicalVolumeLink: string;
  }>;
  saleInfo: {
    country: string;
    saleability: string;
    isEbook: boolean;
  };
  accessInfo: {
    country: string;
    viewability: string;
    embeddable: boolean;
    publicDomain: boolean;
    textToSpeechPermission: string;
    epub: {
      isAvailable: boolean;
    };
    pdf: {
      isAvailable: boolean;
    };
    webReaderLink: string;
    accessViewStatus: string;
    quoteSharingAllowed: boolean;
  };
  searchInfo: {
    textSnippet: string;
  };
}

export async function googleBooksQuery(query: string) {
  const r = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`
  );
  const r_1 = (await r.json()) as GoogleBooksResponse;
  return r_1.items ?? [];
}

export async function googleBooksQueryIsbn(
  isbn: IsbnStrWithChecksum
): Promise<GoogleBooksItem | null> {
  const r = await googleBooksQuery(`isbn:${isbn}`);
  if (r.length === 0) return null;
  if (r.length > 1) console.warn("multiple results for isbn", isbn, r);
  return r[0];
}
