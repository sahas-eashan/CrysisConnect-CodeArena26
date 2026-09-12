"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function RegisterPage() {
  const { confirm, register } = useAuth();
  const [stage, setStage] = useState<"register" | "confirm">("register");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    await register(email, password, email);
    setUsername(email);
    setStage("confirm");
    setMessage("Confirmation code sent. In demo mode this page still works as a placeholder for the Cognito flow.");
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code"));

    await confirm(username, code);
    setMessage("Registration confirmed. You can now sign in.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardTitle>Register for CrisisConnect</CardTitle>
        <CardDescription className="mt-2">
          Citizens self-register. Large NGOs still require approval inside the government portal after signup.
        </CardDescription>
        {stage === "register" ? (
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleRegister}>
            <Input className="md:col-span-2" name="fullName" placeholder="Full name" required />
            <Input name="email" placeholder="Email" required type="email" />
            <Input name="phone" placeholder="Phone number" />
            <Input name="password" placeholder="Password" required type="password" />
            <select
              className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              name="role"
            >
              <option value="citizen">Citizen</option>
              <option value="ngo">NGO / Field worker</option>
            </select>
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
