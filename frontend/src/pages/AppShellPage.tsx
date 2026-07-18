import { useRef } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TopBar } from "../components/ui/TopBar";
import {
  VaultDial,
  type VaultDialHandle,
} from "../components/ui/VaultDial";
import { useAuthStore } from "../store/authStore";
import styles from "./AppShellPage.module.css";

export default function AppShellPage() {
  const user = useAuthStore((s) => s.user);
  const dialRef = useRef<VaultDialHandle>(null);

  return (
    <div className={styles.shell}>
      <TopBar userName={user?.full_name ?? "ראש צוות"} />
      <main className={styles.main}>
        <div className={styles.dialRow}>
          <VaultDial ref={dialRef} completed={0} total={0} />
          <Button
            variant="secondary"
            onClick={() => dialRef.current?.completeStep()}
          >
            הדגם נקישה
          </Button>
        </div>
        <Card className={styles.welcome}>
          <h1 className={styles.heading}>ברוך הבא!</h1>
          <p className={styles.copy}>כאן ייבנה מסך תכנון הסבב</p>
        </Card>
      </main>
    </div>
  );
}
