declare module "isbn3/lib/calculate_check_digit" {
  export default function calculateCheckDigit(isbn: string): string;
}
declare module "simple-zstd" {
  export function ZSTDDecompress(): any;
}

import type {} from "react-select/base";
import { Store } from "./lib/Store";
// This import is necessary for module augmentation.
// It allows us to extend the 'Props' interface in the 'react-select/base' module
// and add our custom property 'myCustomProp' to it.

declare module "react-select/base" {
  export interface Props<
    Option,
    IsMulti extends boolean,
    Group extends GroupBase<Option>
  > {
    store: Store;
  }
}
