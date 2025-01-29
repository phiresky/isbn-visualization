import { useMemo, type FC } from "react";

import { IsbnMap } from "./components/IsbnMap";
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
  return <IsbnMap config={config} />;
};

export default App;
