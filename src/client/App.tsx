// =============================================================================
// client/App
// ルートコンポーネント。ログイン状態に応じてログイン画面／調整画面を出し分ける。
// =============================================================================

import { Suspense } from "react";
import { Toasty } from "@cloudflare/kumo/components/toast";
import { useAuth } from "./hooks/useAuth";
import { ScheduleScreen } from "./components/ScheduleScreen";
import { LoginScreen } from "./components/LoginScreen";

function Loading() {
  return (
    <div className="flex items-center justify-center h-screen text-kumo-inactive">
      Loading...
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return (
      <Toasty>
        <LoginScreen />
      </Toasty>
    );
  }

  return (
    <Toasty>
      <Suspense fallback={<Loading />}>
        <ScheduleScreen user={user} />
      </Suspense>
    </Toasty>
  );
}
