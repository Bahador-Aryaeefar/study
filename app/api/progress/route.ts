import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "progress.json");

let queue: Promise<unknown> = Promise.resolve();

const empty ={ version: 1, done: {}, notes: {} };

export async function GET() {
  try {
    const text = await fs.readFile(FILE, "utf8");
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(empty);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.done !== "object" || typeof body.notes !== "object") {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    const data = {
      version: 1,
      done: body.done,
      notes: body.notes,
      updatedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const run = async () => {
      const tmp = `${FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, FILE);
    };
    const job = queue.then(run, run);
    queue = job.catch(() => undefined);
    await job;
    return NextResponse.json({ ok: true, updatedAt: data.updatedAt });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
