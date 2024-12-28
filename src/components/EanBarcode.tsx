import b from "jsbarcode";

export function EanBarcode2(props: { ean: string }) {
  return (
    <svg
      ref={(svg) => {
        if (!svg) return;
        b(svg, props.ean, { format: "EAN13", width: 2, height: 100 });
      }}
    />
  );
}

export function EanBarcode(props: { ean: string }) {
  return <span className="ean13">{props.ean}</span>;
}
