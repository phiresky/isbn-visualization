import { useMemo, type FC } from "react";

import { IsbnView } from "./components/IsbnView";
import { bookshelfConfig } from "./projections/bookshelf";

const App: FC = () => {
  const config = useMemo(
    () =>
      bookshelfConfig({
        width: Math.min(
          1500,
          document.body.clientWidth,
          (document.body.clientHeight / 2) * Math.sqrt(10)
        ),
      }),
    []
  );
  return <IsbnView config={config} />;
};

export default App;
