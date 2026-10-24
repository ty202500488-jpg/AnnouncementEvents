import Layout from "../../assets/components/Layout.jsx";
import { DataProvider } from "./context/DataContext.jsx";

export default function AdminDashboard() {
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  );
}
