"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function RegisterPage() {
  const { confirm, register } = useAuth();
  const [stage, setStage] = useState<"register" | "confirm">("register");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    await register(email, password, email);
    setUsername(email);
    setStage("confirm");
    setMessage("Check your email for the confirmation code.");
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code"));

    await confirm(username, code);
    setMessage("Registration confirmed. You can now sign in.");
  }

  if (!hasAwsConfig) {
    const developmentDemo = process.env.NODE_ENV === "development";
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardTitle>{developmentDemo ? "Explore without registering" : "Registration unavailable"}</CardTitle>
          <CardDescription className="mt-2">
            {developmentDemo
              ? "The local demonstration uses sample roles. No account or password is needed."
              : "Account registration has not been configured for this deployment."}
          </CardDescription>
          <p className="mt-6 text-sm"><Link className="text-primary" href={developmentDemo ? "/login" : "/public-map"}>{developmentDemo ? "Open demo portals" : "View the public map"}</Link></p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardTitle>Register for CrisisConnect</CardTitle>
        <CardDescription className="mt-2">
          Create a citizen account. Response-team access is assigned by administrators.
        </CardDescription>
        {stage === "register" ? (
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleRegister}>
            <Input name="email" placeholder="Email" required type="email" />
            <Input name="password" placeholder="Password" required type="password" />
            <Button className="md:col-span-2" type="submit">
              Create account
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleConfirm}>
            <Input name="code" placeholder="Confirmation code" required />
            <Button type="submit">Confirm registration</Button>
          </form>
        )}
        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
      </Card>
    </main>
  );
}
