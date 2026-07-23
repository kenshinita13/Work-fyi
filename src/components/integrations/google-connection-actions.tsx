"use client";

import { Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function GoogleConnectionActions() {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/integrations/google/disconnect", {
        method: "POST",
      });
      if (!response.ok)
        throw new Error("Google Workspace could not be disconnected.");
      toast.success("Google Workspace disconnected.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Disconnect failed.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disconnecting}>
          <Link2Off className="size-4" aria-hidden="true" />
          Disconnect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Google Workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Work.fyi will revoke its Google access and remove encrypted tokens
            and document links. Google files already created will remain in
            Drive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={disconnect}>Disconnect</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
