import "./App.css";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Footer } from "./Footer";
import { Body } from "./Body";
import { Header } from "./Header";
import { LocalizationProvider } from "@mui/x-date-pickers";

function App() {
  return (
    <div className="wrapper">
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Header />
        <Body />
        <Footer />
      </LocalizationProvider>
    </div>
  );
}

export default App;
