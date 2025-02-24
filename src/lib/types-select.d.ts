import type {} from "react-select/base";
import { Store } from "./Store";
// This import is necessary for module augmentation.
// It allows us to extend the 'Props' interface in the 'react-select/base' module
// and add our custom property 'myCustomProp' to it.

declare module "react-select/base" {
  export interface Props<
    Option,
    _IsMulti extends boolean,
    _Group extends GroupBase<Option>,
  > {
    store: Store;
  }
}
