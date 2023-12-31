import axios from "axios";
import { useContext, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import AccountNav from "../AccountNav";
import { UserContext } from "../UserContext";
import PlacesPage from "./PlacesPage";

export default function ProfilePage() {
  const { ready, user, setUser } = useContext(UserContext);
  const [redirect, setRedirect] = useState(null);
  let { subpage } = useParams();
  if (subpage === undefined) {
    subpage = "profile";
  }

  async function logout() {
    await axios.post("/logout");
    setRedirect("/");
    setUser(null);
  }

  if (!ready) {
    return "loading.....";
  }

  if (ready && !user && !redirect) {
    return <Navigate to={"/login"} />;
  }

  if (redirect) {
    return <Navigate to={redirect} />;
  }

  return (
    <div>
      {subpage === "profile" && user.role == "admin" && (
        <Navigate to="/account/Analytic" />
      )}
      <AccountNav />
      <div className="text-center max-w-lg mx-auto">
        Logged in as {user.name} ({user.email})<br />
        <button onClick={logout} className="primary max-w-sm mt-2">
          Logout
        </button>
      </div>
      {subpage === "places" && <PlacesPage />}
    </div>
  );
}
