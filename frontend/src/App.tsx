import AppRoutes from "./routes";
import { useAuth } from "./app/AuthProvider";

export default function App() {
  const { userId } = useAuth();

  return (
    <>
      {userId ? <div className="authStatus">Innlogget</div> : null}
      <AppRoutes />
    </>
  );
}
