import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen max-w-md pb-24">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
