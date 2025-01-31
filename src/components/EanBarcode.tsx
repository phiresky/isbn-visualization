export function EanBarcode(props: { ean: string }) {
  return <span className="ean13">{props.ean}</span>;
}
