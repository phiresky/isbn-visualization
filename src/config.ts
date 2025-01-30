import { MinimalGoogleBooksItem } from "./components/Controls";
import { RuntimeConfiguration } from "./lib/RuntimeConfiguration";
import { IsbnStrWithChecksum } from "./lib/util";

export type DatasetOption = {
  id: string;
  name: string;
  description?: string;
  runtimeConfig?: Partial<RuntimeConfiguration>;
  colorSchemeMeaning?: ColorSchemeMeaning | null;
};
export type ColorSchemeMeaning = {
  title: string;
  markers: { value: number; label: string }[];
};
export const defaultColorSchemeMeaning = {
  title: "Books",
  markers: [
    { value: 0, label: "0%" },
    { value: 0.5, label: "50% allocated" },
    { value: 1, label: "100%" },
  ],
};
export default {
  bookshelfColor: [0.5, 0.1, 0.1, 1.0],
  bookshelfColorHex: "#7f1a1a",
  datasetOptions: [
    {
      id: "all",
      name: "All Known Books",
      description: "Books in various sources",
    },
    {
      id: "publication_date",
      name: "Publication Date",
      description: "Shows the publication year of books",
      runtimeConfig: {
        shaderGlow: 4,
        colorGradient: 2,
      },
      colorSchemeMeaning: {
        title: "Publication year",
        markers: [
          { value: 0, label: "≤1985" },
          { value: 0.25, label: "" },
          // { value: (2000 - 1985) / (2025 - 1985), label: "2000" },
          { value: 0.5, label: String((2025 + 1985) / 2) },
          { value: 0.75, label: "" },
          { value: 1, label: "2025" },
        ],
      },
    },
    {
      id: "all-md5",
      name: "All ISBNs (red), md5s (green)",
      description:
        "Shows which proportion of books have at least one file in AA.",
      runtimeConfig: {
        colorGradient: 4,
      },
      colorSchemeMeaning: {
        title: "File Availability",
        markers: [
          { value: 0, label: "Missing" },
          { value: 0.5, label: "50%" },
          { value: 1, label: "100% present" },
        ],
      },
    },
    {
      id: "rarity",
      name: "Rarity data",
      description:
        "Shows which books are rare, based on how many libraries they are in.",
      colorSchemeMeaning: {
        title: "Rarity",
        markers: Array.from({ length: 21 }).map((_, i) => ({
          value: (i / 20.0) ** 2,
          label: { 0: "0 libraries", 10: "10", 20: "20+" }[i] || "",
        })),
      },
      runtimeConfig: {
        colorGradient: 4,
      },
    },
    {
      id: "publishers",
      name: "Publisher Ranges",
      description:
        "Assigns a random color to each unique publisher so the prefixes of each one are visible.",
      runtimeConfig: {
        publishersColorSchema: "hsl",
      },
      colorSchemeMeaning: null,
    },
    {
      id: "gbooks",
      name: "Google Books",
      description: "Books that are or were present in Google Books are white.",
    },
    { id: "md5", name: "Files in AA" },
    { id: "cadal_ssno", name: "CADAL SSNOs" },
    { id: "cerlalc", name: "CERLALC data leak" },
    { id: "duxiu_ssid", name: "DuXiu SSIDs" },
    { id: "edsebk", name: "EBSCOhost’s eBook Index" },
    { id: "goodreads", name: "Goodreads" },
    { id: "ia", name: "Internet Archive" },
    { id: "isbndb", name: "ISBNdb" },
    { id: "isbngrp", name: "ISBN Global Register of Publishers" },
    { id: "libby", name: "Libby" },
    { id: "nexusstc", name: "Nexus/STC" },
    { id: "oclc", name: "OCLC/Worldcat" },
    { id: "ol", name: "OpenLibrary" },
    { id: "rgb", name: "Russian State Library" },
    { id: "trantor", name: "Imperial Library of Trantor" },
  ] as DatasetOption[],
  exampleBooks: [
    {
      id: "gatsby",
      volumeInfo: {
        title: "The Great Gatsby",
        authors: ["F. Scott Fitzgerald"],
        industryIdentifiers: [
          {
            type: "ISBN_13",
            identifier: "9780743273565" as IsbnStrWithChecksum,
          },
        ],
      },
    },
    {
      id: "ctacher",
      volumeInfo: {
        title: "The Catcher in the Rye",
        authors: ["J.D. Salinger"],
        industryIdentifiers: [
          {
            type: "ISBN_13",
            identifier: "9780316769488" as IsbnStrWithChecksum,
          },
        ],
      },
    },
    {
      id: "got",
      volumeInfo: {
        title: "A Game of Thrones",
        authors: ["George R. R. Martin"],
        industryIdentifiers: [
          {
            type: "ISBN_13",
            identifier: "9780553381689" as IsbnStrWithChecksum,
          },
        ],
      },
    },
    {
      id: "hp1",
      volumeInfo: {
        title: "Harry Potter and the Philosopher's Stone",
        authors: ["J.K. Rowling"],
        industryIdentifiers: [
          {
            type: "ISBN_13",
            identifier: "9780590353427" as IsbnStrWithChecksum,
          },
        ],
      },
    },
  ] as MinimalGoogleBooksItem[],
  externalSearchEngines: [
    {
      name: "Google Books",
      url: "https://books.google.com/books?vid=ISBN%s", //"https://www.google.com/search?udm=36&q=isbn%3A%s",
    },
    { name: "Worldcat", url: "https://worldcat.org/isbn/%s" },
  ],
  imagesRoot:
    window.origin === "https://phiresky.github.io"
      ? "/isbn-visualization-images/tiled"
      : "/images/tiled",
  jsonRoot:
    window.origin === "https://phiresky.github.io"
      ? "/isbn-visualization-json/prefix-data"
      : "/prefix-data",
  jsonCompression: "gzip",
};
