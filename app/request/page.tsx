
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function RequestPage() {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!date || !name.trim() || !position.trim() ||
        !reason.trim() || !amount || Number(amount) <= 0) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบและจำนวนเงินต้องมากกว่า 0");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("expense_requests")
        .insert({
  request_date: date,
  requester_name: name.trim(),
  position: position.trim(),
  reason: reason.trim(),
  amount: Number(amount),
  status: "ใบเบิกใหม่",
  admin_seen_at: null,
});

      if (error) throw error;

      setMessage("บันทึกใบเบิกสำเร็จแล้ว");
      setDate("");
      setName("");
      setPosition("");
      setReason("");
      setAmount("");
    } catch (error) {
  console.error(
    "Save expense request error:",
    JSON.stringify(error, Object.getOwnPropertyNames(error as object))
  );

  const err = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  setErrorMessage(
    [
      err.message || "ไม่ทราบสาเหตุ",
      err.details,
      err.hint,
      err.code ? `รหัส: ${err.code}` : "",
    ]
      .filter(Boolean)
      .join(" | ")
  );
} finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm text-slate-500 hover:text-slate-800">
          ← กลับหน้าหลัก
        </a>

        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          เบิกเงิน
        </h1>
        <p className="mt-1 text-slate-500">สร้างใบเบิกเงินล่วงหน้า</p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              วันที่เบิก
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              ชื่อผู้เบิก
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="กรอกชื่อผู้เบิก"
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              ตำแหน่ง
            </label>
            <input
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="เช่น ช่างเซอร์วิส"
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              เหตุผล / รายละเอียดการเบิก
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลในการเบิกเงิน"
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              จำนวนเงินที่ขอเบิก (บาท)
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          {message && (
            <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {message}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <a
              href="/"
              className="flex-1 rounded-xl border border-slate-300 px-5 py-3 text-center font-medium"
            >
              ยกเลิก
            </a>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกใบเบิก"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
