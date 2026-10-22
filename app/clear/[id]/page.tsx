
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type ExpenseRequest = {
  id: string;
  created_at: string;
  request_date: string;
  requester_name: string;
  position: string;
  reason: string;
  amount: number;
  status: string;
};

type ExpenseItem = {
  id: string;
  description: string;
  amount: string;
};

type SavedClearing = {
  id: string;
  request_id: string;
  clearing_date: string;
  clearer_name: string;
  clearer_position: string;
  requested_amount: number;
  total_expenses: number;
  status: string;
  created_at: string;
};

type SavedItem = {
  id: string;
  description: string;
  amount: number;
  sort_order: number;
};

type AdvanceRequest = {
  id: string;
  advance_date: string | null;
  amount: number;
  reason: string;
  requested_by: string;
  requested_at: string;
};

type PageMode = "clear" | "advance";

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function ClearDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<PageMode>("clear");
  const [backPath, setBackPath] = useState("/clear");

  const [request, setRequest] = useState<ExpenseRequest | null>(null);
  const [clearing, setClearing] = useState<SavedClearing | null>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [requestId, setRequestId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [clearingDate, setClearingDate] = useState("");
  const [clearerName, setClearerName] = useState("");
  const [clearerPosition, setClearerPosition] = useState("");

  const [approvedAdvances, setApprovedAdvances] = useState<
    AdvanceRequest[]
  >([]);

  const approvedAdvanceTotal = approvedAdvances.reduce(
    (sum, advance) => sum + Number(advance.amount || 0),
    0
  );

  const [advanceDate, setAdvanceDate] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [advanceMessage, setAdvanceMessage] = useState("");
  const [advanceSuccess, setAdvanceSuccess] = useState(false);

  const [items, setItems] = useState<ExpenseItem[]>([
    { id: "item-1", description: "", amount: "" },
  ]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const selectedMode = search.get("mode");
    const from = search.get("from");

    setMode(selectedMode === "advance" ? "advance" : "clear");
    setBackPath(from === "admin" ? "/admin" : "/clear");

    const today = getLocalDate();
    setAdvanceDate(today);
    setClearingDate(today);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const resolved = await params;

        if (cancelled) return;

        setRequestId(resolved.id);

        const today = getLocalDate();
        setClearingDate(today);
        setAdvanceDate(today);

        const { data: requestData, error: requestError } =
          await supabase
            .from("expense_requests")
            .select("*")
            .eq("id", resolved.id)
            .single();

        if (requestError) {
          throw new Error(requestError.message);
        }

        if (cancelled) return;

        setRequest(requestData as ExpenseRequest);

        const { data: advanceData, error: advanceError } =
          await supabase
            .from("expense_advance_requests")
            .select(
              "id, advance_date, amount, reason, requested_by, requested_at"
            )
            .eq("parent_request_id", resolved.id)
            .eq("status", "อนุมัติแล้ว")
            .order("requested_at", { ascending: true });

        if (advanceError) {
          throw new Error(advanceError.message);
        }

        if (cancelled) return;

        setApprovedAdvances(
          (advanceData || []) as AdvanceRequest[]
        );

        const { data: clearingData, error: clearingError } =
          await supabase
            .from("expense_clearings")
            .select("*")
            .eq("request_id", resolved.id)
            .maybeSingle();

        if (clearingError) {
          throw new Error(clearingError.message);
        }

        if (cancelled) return;

        if (clearingData) {
          const saved = clearingData as SavedClearing;

          setClearing(saved);
          setClearingDate(saved.clearing_date || today);
          setClearerName(saved.clearer_name || "");
          setClearerPosition(saved.clearer_position || "");

          const { data: itemData, error: itemError } =
            await supabase
              .from("expense_clearing_items")
              .select("*")
              .eq("clearing_id", saved.id)
              .order("sort_order", { ascending: true });

          if (itemError) {
            throw new Error(itemError.message);
          }

          if (cancelled) return;

          setSavedItems((itemData || []) as SavedItem[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "ไม่สามารถโหลดข้อมูลได้"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [params]);

  function formatMoney(amount: number) {
    return Number(amount || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(date: string | null) {
    if (!date) return "-";

    const datePart = date.split("T")[0];
    const [year, month, day] = datePart.split("-");

    if (!year || !month || !day) return date;

    return `${day}/${month}/${Number(year) + 543}`;
  }

  function getAdvanceDate(advance: AdvanceRequest) {
    return formatDate(
      advance.advance_date || advance.requested_at || null
    );
  }

  function updateItem(
    id: string,
    field: "description" | "amount",
    value: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: `item-${Date.now()}-${current.length}`,
        description: "",
        amount: "",
      },
    ]);
  }

  function removeItem(id: string) {
    setItems((current) =>
      current.length > 1
        ? current.filter((item) => item.id !== id)
        : current
    );
  }

  const requestedAmount = clearing
    ? Number(clearing.requested_amount || 0)
    : Number(request?.amount || 0) + approvedAdvanceTotal;

  const totalExpenses = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  const difference = requestedAmount - totalExpenses;
  const alreadyCleared = Boolean(clearing);

  const statusMismatch =
    !clearing &&
    request !== null &&
    request.status !== "รอเคลียร์";

  const savedDifference = clearing
    ? Number(clearing.requested_amount) -
      Number(clearing.total_expenses)
    : 0;

  // ลบใบเบิกจากหน้ารายละเอียดที่เปิดผ่านหน้าแอดมิน
  async function deleteRequest() {
    if (!request || deleting) return;

    if (backPath !== "/admin" || mode !== "clear") {
      setError("ปุ่มลบใช้ได้จากหน้ารายละเอียดของแอดมินเท่านั้น");
      return;
    }

    const confirmed = window.confirm(
      `ยืนยันลบใบเบิกของ ${request.requester_name} ใช่หรือไม่?\n\n` +
        `สถานะปัจจุบัน: ${request.status}\n` +
        `จำนวนเงิน: ${formatMoney(Number(request.amount))} บาท\n\n` +
        "ข้อมูลใบเบิก ใบเคลียร์ รายการค่าใช้จ่าย และคำขอเบิกเงินเพิ่มที่เกี่ยวข้องจะถูกลบ และไม่สามารถกู้คืนจากระบบนี้ได้"
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      const { data, error: deleteError } = await supabase.rpc(
        "delete_expense_request",
        {
          p_request_id: request.id,
        }
      );

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (!data || data.success !== true) {
        throw new Error(
          data?.message || "ระบบไม่สามารถยืนยันการลบใบเบิกได้"
        );
      }

      window.alert("ลบใบเบิกและรายการที่เกี่ยวข้องเรียบร้อยแล้ว");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      console.error("Delete expense request failed:", err);

      setError(
        err instanceof Error
          ? `ลบใบเบิกไม่สำเร็จ: ${err.message}`
          : "ลบใบเบิกไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      setDeleting(false);
    }
  }

  async function submitAdvanceRequest() {
    if (!request || advanceSaving) return;

    setAdvanceMessage("");
    setAdvanceSuccess(false);

    const amount = Number(advanceAmount);

    if (request.status !== "รอเคลียร์") {
      setAdvanceMessage(
        "ใบเบิกนี้ไม่ได้อยู่ในสถานะรอเคลียร์ จึงไม่สามารถส่งคำขอเพิ่มได้"
      );
      return;
    }

    if (!advanceDate) {
      setAdvanceMessage("กรุณาเลือกวันที่ขอเบิกเงินเพิ่ม");
      return;
    }

    if (!clearerName.trim()) {
      setAdvanceMessage("กรุณากรอกชื่อผู้ขอเบิก");
      return;
    }

    if (
      !advanceAmount.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setAdvanceMessage(
        "กรุณากรอกจำนวนเงินที่ต้องการเบิกเพิ่มให้ถูกต้อง"
      );
      return;
    }

    if (!advanceReason.trim()) {
      setAdvanceMessage("กรุณาระบุเหตุผลที่ขอเบิกเงินเพิ่ม");
      return;
    }

    setAdvanceSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("expense_advance_requests")
        .insert({
          parent_request_id: request.id,
          advance_date: advanceDate,
          amount,
          reason: advanceReason.trim(),
          status: "รออนุมัติ",
          requested_by: clearerName.trim(),
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setAdvanceSuccess(true);
      setAdvanceMessage(
        "ส่งคำขอเบิกเงินเพิ่มเรียบร้อยแล้ว รอแอดมินตรวจสอบและอนุมัติ"
      );

      setAdvanceAmount("");
      setAdvanceReason("");
      setAdvanceDate(getLocalDate());
    } catch (err) {
      setAdvanceSuccess(false);
      setAdvanceMessage(
        err instanceof Error
          ? `ส่งคำขอไม่สำเร็จ: ${err.message}`
          : "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      setAdvanceSaving(false);
    }
  }

  async function saveClearing() {
    if (!request || saving) return;

    setError("");

    if (clearing) {
      setError("ใบเคลียร์บิลนี้บันทึกแล้ว ไม่สามารถบันทึกซ้ำได้");
      return;
    }

    if (request.status !== "รอเคลียร์") {
      setError(
        "ใบเบิกนี้ไม่ได้อยู่ในสถานะรอเคลียร์ กรุณาตรวจสอบรายการก่อน"
      );
      return;
    }

    if (
      !clearingDate ||
      !clearerName.trim() ||
      !clearerPosition.trim()
    ) {
      setError(
        "กรุณากรอกวันที่เคลียร์ ชื่อผู้เคลียร์ และตำแหน่งให้ครบ"
      );
      return;
    }

    const hasIncompleteItem = items.some((item) => {
      const hasDescription = item.description.trim() !== "";
      const hasAmount = item.amount.trim() !== "";

      if (!hasDescription && !hasAmount) return false;

      return (
        !hasDescription ||
        !hasAmount ||
        !Number.isFinite(Number(item.amount)) ||
        Number(item.amount) <= 0
      );
    });

    if (hasIncompleteItem) {
      setError(
        "กรุณากรอกรายการและจำนวนเงินให้ครบ หรือเอารายการที่ไม่ใช้ออก"
      );
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.description.trim() !== "" &&
        Number.isFinite(Number(item.amount)) &&
        Number(item.amount) > 0
    );

    if (validItems.length === 0) {
      setError("กรุณากรอกรายการค่าใช้จ่ายอย่างน้อย 1 รายการ");
      return;
    }

    setSaving(true);

    try {
      const { data, error: saveError } = await supabase.rpc(
        "save_expense_clearing",
        {
          p_request_id: request.id,
          p_clearing_date: clearingDate,
          p_clearer_name: clearerName.trim(),
          p_clearer_position: clearerPosition.trim(),
          p_items: validItems.map((item) => ({
            description: item.description.trim(),
            amount: Number(item.amount),
          })),
        }
      );

      if (saveError) {
        throw new Error(saveError.message);
      }

      if (!data) {
        throw new Error(
          "ระบบไม่ส่งรหัสใบเคลียร์กลับมา กรุณาตรวจสอบข้อมูล"
        );
      }

      alert("ส่งใบเคลียร์บิลให้แอดมินตรวจสอบเรียบร้อยแล้ว");
      window.location.reload();
    } catch (err) {
      console.error(err);

      try {
        const { data: latestClearing, error: latestError } =
          await supabase
            .from("expense_clearings")
            .select("*")
            .eq("request_id", requestId)
            .maybeSingle();

        if (latestError) {
          throw new Error(latestError.message);
        }

        if (latestClearing) {
          const saved = latestClearing as SavedClearing;

          setClearing(saved);

          const { data: latestItems, error: latestItemsError } =
            await supabase
              .from("expense_clearing_items")
              .select("*")
              .eq("clearing_id", saved.id)
              .order("sort_order", { ascending: true });

          if (latestItemsError) {
            throw new Error(latestItemsError.message);
          }

          setSavedItems((latestItems || []) as SavedItem[]);
          setError(
            "พบใบเคลียร์ที่บันทึกไว้แล้ว ระบบโหลดข้อมูลเดิมมาแสดงเพื่อป้องกันการบันทึกซ้ำ"
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
          );
        }
      } catch (reloadError) {
        setError(
          reloadError instanceof Error
            ? reloadError.message
            : "บันทึกไม่สำเร็จและโหลดข้อมูลกลับมาตรวจสอบไม่ได้"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmClearing() {
    if (confirmingClear || !request || !clearing) return;

    if (backPath !== "/admin") {
      setError("ปุ่มนี้ใช้ยืนยันได้จากหน้าแอดมินเท่านั้น");
      return;
    }

    if (request.status !== "รอตรวจสอบ") {
      setError(
        "ใบเบิกนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ กรุณารีเฟรชข้อมูล"
      );
      return;
    }

    const confirmed = window.confirm(
      "ยืนยันเคลียร์บิลใช่หรือไม่?\nสถานะจะเปลี่ยนเป็น เคลียร์บิลแล้ว"
    );

    if (!confirmed) return;

    setConfirmingClear(true);
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("expense_requests")
        .update({ status: "เคลียร์บิลแล้ว" })
        .eq("id", request.id)
        .eq("status", "รอตรวจสอบ")
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (!data) {
        throw new Error(
          "ไม่พบรายการที่เปลี่ยนสถานะได้ กรุณารีเฟรชหน้าและตรวจสอบสถานะอีกครั้ง"
        );
      }

      setRequest((current) =>
        current
          ? { ...current, status: "เคลียร์บิลแล้ว" }
          : current
      );

      alert("ยืนยันเคลียร์บิลเรียบร้อยแล้ว");
    } catch (err) {
      setError(
        err instanceof Error
          ? `ยืนยันเคลียร์บิลไม่สำเร็จ: ${err.message}`
          : "ยืนยันเคลียร์บิลไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      setConfirmingClear(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-center">
          กำลังโหลดข้อมูลใบเบิก...
        </div>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6">
          <h1 className="text-xl font-bold text-red-600">
            ไม่สามารถโหลดใบเบิกได้
          </h1>

          <p className="mt-3 text-sm text-red-600">{error}</p>

          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-white"
          >
            กลับหน้าเคลียร์บิล
          </button>
        </div>
      </main>
    );
  }

  const canPrint =
    mode === "clear" &&
    request.status === "เคลียร์บิลแล้ว" &&
    alreadyCleared;

  return (
    <main className="min-h-screen bg-gray-100 p-4 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl print:max-w-none">
        <div className="mb-5 flex items-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="rounded-lg border bg-white px-3 py-2"
          >
            ← กลับ
          </button>

          <div>
            <h1 className="text-2xl font-bold">
              {mode === "advance" ? "ขอเบิกเงินเพิ่ม" : "ใบเคลียร์บิล"}
            </h1>

            <p className="text-sm text-gray-500">
              {mode === "advance"
                ? "ส่งคำขอเบิกเงินเพิ่มจากใบเบิกนี้"
                : "เคลียร์ค่าใช้จ่ายจากใบเบิก"}
            </p>
          </div>
        </div>

        {canPrint && (
          <div className="mb-4 flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              🖨️ พิมพ์ใบเบิก / ใบเคลียร์
            </button>
          </div>
        )}

        {canPrint && clearing && (
          <article className="hidden print:block print-report">
            <h1 className="text-center text-xl font-bold">
              ใบเบิกเงินและใบเคลียร์ค่าใช้จ่าย
            </h1>

            <p className="mb-4 text-center text-sm">
              เอกสารสรุปการเบิกเงินและค่าใช้จ่ายจริง
            </p>

            <div className="print-box">
              <h2 className="mb-2 font-bold">1. ข้อมูลใบเบิก</h2>

              <div className="print-grid">
                <p>
                  <strong>วันที่เบิก:</strong>{" "}
                  {formatDate(request.request_date)}
                </p>
                <p>
                  <strong>ผู้เบิก:</strong> {request.requester_name}
                </p>
                <p>
                  <strong>ตำแหน่ง:</strong> {request.position}
                </p>
                <p>
                  <strong>สถานะ:</strong> {request.status}
                </p>
              </div>

              <p className="mt-2">
                <strong>เหตุผล:</strong> {request.reason}
              </p>

              <p className="mt-2 text-right">
                <strong>จำนวนเงินที่เบิกทั้งหมด:</strong>{" "}
                {formatMoney(requestedAmount)} บาท
              </p>

              {approvedAdvances.length > 0 && (
                <div className="mt-3">
                  <h3 className="mb-2 font-bold">
                    รายละเอียดการเบิกเงินเพิ่มที่อนุมัติแล้ว
                  </h3>

                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>วันที่เบิกเพิ่ม</th>
                        <th>ผู้ขอเบิก</th>
                        <th>เหตุผล</th>
                        <th className="print-amount">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedAdvances.map((advance) => (
                        <tr key={advance.id}>
                          <td>{getAdvanceDate(advance)}</td>
                          <td>{advance.requested_by || "-"}</td>
                          <td>{advance.reason || "-"}</td>
                          <td className="print-amount">
                            {formatMoney(Number(advance.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="print-box">
              <h2 className="mb-2 font-bold">2. ข้อมูลการเคลียร์</h2>

              <div className="print-grid">
                <p>
                  <strong>วันที่เคลียร์:</strong>{" "}
                  {formatDate(clearing.clearing_date)}
                </p>
                <p>
                  <strong>ผู้เคลียร์:</strong> {clearing.clearer_name}
                </p>
                <p>
                  <strong>ตำแหน่ง:</strong>{" "}
                  {clearing.clearer_position}
                </p>
              </div>
            </div>

            <div className="print-box">
              <h2 className="mb-2 font-bold">
                3. รายการค่าใช้จ่ายจริง
              </h2>

              <table className="print-table">
                <thead>
                  <tr>
                    <th className="print-number">ลำดับ</th>
                    <th>รายการ</th>
                    <th className="print-amount">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {savedItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="print-number">{index + 1}</td>
                      <td>{item.description}</td>
                      <td className="print-amount">
                        {formatMoney(Number(item.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="print-totals">
                <p>
                  <span>รวมค่าใช้จ่ายจริง</span>
                  <strong>
                    {formatMoney(Number(clearing.total_expenses))} บาท
                  </strong>
                </p>
                <p>
                  <span>เงินที่เบิกทั้งหมด</span>
                  <strong>
                    {formatMoney(Number(clearing.requested_amount))} บาท
                  </strong>
                </p>
                <p>
                  <span>ผลต่าง</span>
                  <strong
                    className={
                      savedDifference > 0
                        ? "text-green-700"
                        : savedDifference < 0
                          ? "text-red-600"
                          : "text-black"
                    }
                  >
                    {savedDifference > 0
                      ? `ต้องคืนบริษัท ${formatMoney(savedDifference)} บาท`
                      : savedDifference < 0
                        ? `บริษัทต้องจ่ายเพิ่ม ${formatMoney(
                            Math.abs(savedDifference)
                          )} บาท`
                        : "ยอดพอดี"}
                  </strong>
                </p>
              </div>
            </div>

            <p className="mt-4 text-right text-xs">
              พิมพ์จากระบบบันทึกใบเบิกและเคลียร์ค่าใช้จ่าย
            </p>
          </article>
        )}

        <div className={canPrint ? "print:hidden" : ""}>
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">ข้อมูลใบเบิก</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">วันที่เบิก</p>
                <p className="mt-1 font-medium">
                  {formatDate(request.request_date)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">ผู้เบิก</p>
                <p className="mt-1 font-medium">
                  {request.requester_name}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">ตำแหน่ง</p>
                <p className="mt-1 font-medium">{request.position}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">เหตุผล</p>
                <p className="mt-1 font-medium">{request.reason}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                จำนวนเงินที่เบิกรวม (รวมยอดที่อนุมัติเพิ่ม)
              </p>

              <p className="mt-1 text-2xl font-bold">
                {formatMoney(requestedAmount)} บาท
              </p>

              {approvedAdvanceTotal > 0 && (
                <p className="mt-2 text-sm text-green-700">
                  รวมยอดเบิกเพิ่มที่อนุมัติแล้ว{" "}
                  {formatMoney(approvedAdvanceTotal)} บาท
                </p>
              )}
            </div>

            {backPath === "/admin" && mode === "clear" && (
              <div className="mt-5 border-t border-red-100 pt-4">
                <p className="mb-3 text-sm text-gray-500">
                  ใช้สำหรับลบใบเบิกที่ไม่ต้องการแล้ว รวมถึงรายการที่เกี่ยวข้อง
                </p>

                <button
                  type="button"
                  onClick={deleteRequest}
                  disabled={deleting || confirmingClear || saving}
                  className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "กำลังลบใบเบิก..." : "🗑️ ลบใบเบิกนี้"}
                </button>
              </div>
            )}
          </section>

          {mode === "clear" && approvedAdvances.length > 0 && (
            <section className="mt-5 rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-900">
                รายละเอียดการเบิกเงินเพิ่ม
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                รายการต่อไปนี้ได้รับอนุมัติแล้วและรวมอยู่ในยอดเบิกทั้งหมด
              </p>

              <div className="mt-4 space-y-4">
                {approvedAdvances.map((advance, index) => (
                  <div
                    key={advance.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-semibold">
                        รายการเบิกเพิ่มที่ {index + 1}
                      </h3>

                      <span className="font-bold text-blue-700">
                        {formatMoney(Number(advance.amount))} บาท
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-gray-500">
                          วันที่เบิกเพิ่ม
                        </p>
                        <p className="mt-1 font-medium">
                          {getAdvanceDate(advance)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          ผู้ขอเบิก
                        </p>
                        <p className="mt-1 font-medium">
                          {advance.requested_by || "-"}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <p className="text-sm text-gray-500">
                          เหตุผลที่ขอเบิก
                        </p>
                        <p className="mt-1 whitespace-pre-wrap font-medium">
                          {advance.reason || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between gap-3 border-t pt-4">
                <span className="font-bold">
                  รวมยอดเบิกเพิ่มที่อนุมัติแล้ว
                </span>
                <span className="font-bold text-blue-700">
                  {formatMoney(approvedAdvanceTotal)} บาท
                </span>
              </div>
            </section>
          )}

          {mode === "advance" && (
            <>
              {request.status === "รอเคลียร์" && !alreadyCleared ? (
                <section className="mt-5 rounded-xl border border-blue-200 bg-white p-5 shadow-sm print:hidden">
                  <h2 className="text-lg font-bold text-blue-800">
                    💰 ขอเบิกเงินเพิ่ม
                  </h2>

                  <p className="mt-2 text-sm text-gray-600">
                    ส่งคำขอเบิกเงินเพิ่มจากใบเบิกนี้ให้แอดมินพิจารณา
                  </p>

                  <div className="mt-4 space-y-4">
                    <label className="block text-sm font-medium">
                      วันที่ขอเบิกเงินเพิ่ม
                      <input
                        type="date"
                        value={advanceDate}
                        onChange={(e) => setAdvanceDate(e.target.value)}
                        required
                        className="mt-1 w-full rounded-lg border px-3 py-2.5"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      ชื่อผู้ขอเบิก
                      <input
                        value={clearerName}
                        onChange={(e) => setClearerName(e.target.value)}
                        placeholder="กรอกชื่อผู้ขอเบิก"
                        required
                        className="mt-1 w-full rounded-lg border px-3 py-2.5"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      จำนวนเงินที่ต้องการเบิกเพิ่ม (บาท)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        placeholder="ระบุจำนวนเงิน"
                        required
                        className="mt-1 w-full rounded-lg border px-3 py-2.5"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      เหตุผลที่ขอเบิกเงินเพิ่ม
                      <textarea
                        value={advanceReason}
                        onChange={(e) => setAdvanceReason(e.target.value)}
                        placeholder="เช่น เงินสำรองไม่เพียงพอสำหรับค่าใช้จ่ายเพิ่มเติม"
                        rows={3}
                        required
                        className="mt-1 w-full rounded-lg border px-3 py-2.5"
                      />
                    </label>

                    {advanceMessage && (
                      <p
                        className={`rounded-lg p-3 text-sm ${
                          advanceSuccess
                            ? "border border-green-200 bg-green-50 text-green-800"
                            : "border border-orange-200 bg-orange-50 text-orange-800"
                        }`}
                      >
                        {advanceMessage}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={submitAdvanceRequest}
                      disabled={advanceSaving}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {advanceSaving
                        ? "กำลังส่งคำขอ..."
                        : "ส่งคำขอเบิกเงินเพิ่ม"}
                    </button>
                  </div>
                </section>
              ) : (
                <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-5">
                  <h2 className="font-bold text-orange-800">
                    ไม่สามารถขอเบิกเงินเพิ่มได้
                  </h2>

                  <p className="mt-2 text-sm text-orange-800">
                    ใบเบิกนี้ไม่ได้อยู่ในสถานะรอเคลียร์ หรือมีการเคลียร์บิลแล้ว
                    กรุณาตรวจสอบสถานะใบเบิก
                  </p>
                </section>
              )}
            </>
          )}

          {mode === "clear" && (
            <>
              {alreadyCleared ? (
                <>
                  <section className="mt-5 rounded-xl border border-green-200 bg-green-50 p-5">
                    <h2 className="text-lg font-bold text-green-800">
                      ✓ ใบเคลียร์บิลบันทึกแล้ว
                    </h2>

                    <p className="mt-2 text-sm text-green-800">
                      สถานะ: {request.status}
                    </p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-gray-600">
                          วันที่เคลียร์
                        </p>
                        <p className="font-semibold">
                          {formatDate(clearing!.clearing_date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">
                          ผู้เคลียร์
                        </p>
                        <p className="font-semibold">
                          {clearing!.clearer_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">
                          ตำแหน่งผู้เคลียร์
                        </p>
                        <p className="font-semibold">
                          {clearing!.clearer_position}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">
                          ค่าใช้จ่ายจริง
                        </p>
                        <p className="font-semibold">
                          {formatMoney(
                            Number(clearing!.total_expenses)
                          )}{" "}
                          บาท
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold">
                      รายการค่าใช้จ่ายที่บันทึกไว้
                    </h2>

                    {savedItems.length === 0 ? (
                      <p className="mt-3 text-sm text-orange-700">
                        ไม่พบรายการค่าใช้จ่าย กรุณาตรวจสอบข้อมูลในระบบ
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {savedItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex justify-between gap-4 border-b pb-3"
                          >
                            <span>
                              {index + 1}. {item.description}
                            </span>

                            <span className="font-semibold">
                              {formatMoney(Number(item.amount))} บาท
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex justify-between gap-4 border-t pt-4">
                      <span className="font-bold">รวมค่าใช้จ่ายจริง</span>
                      <span className="font-bold">
                        {formatMoney(Number(clearing!.total_expenses))} บาท
                      </span>
                    </div>

                    <div className="mt-3 flex justify-between gap-4">
                      <span>ผลต่าง</span>

                      <span
                        className={`font-semibold ${
                          savedDifference > 0
                            ? "text-green-600"
                            : savedDifference < 0
                              ? "text-red-600"
                              : "text-black"
                        }`}
                      >
                        {savedDifference > 0
                          ? `ต้องคืนบริษัท ${formatMoney(savedDifference)} บาท`
                          : savedDifference < 0
                            ? `บริษัทต้องจ่ายเพิ่ม ${formatMoney(
                                Math.abs(savedDifference)
                              )} บาท`
                            : "ยอดพอดี"}
                      </span>
                    </div>
                  </section>

                  {backPath === "/admin" &&
                    request.status === "รอตรวจสอบ" && (
                      <div className="mt-5 print:hidden">
                        <button
                          type="button"
                          onClick={confirmClearing}
                          disabled={confirmingClear || deleting}
                          className="w-full rounded-xl bg-green-600 px-5 py-3.5 text-lg font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {confirmingClear
                            ? "กำลังยืนยัน..."
                            : "✓ ยืนยันเคลียร์บิล"}
                        </button>
                      </div>
                    )}
                </>
              ) : statusMismatch ? (
                <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-5">
                  <h2 className="font-bold text-orange-800">
                    ไม่สามารถเปิดแบบฟอร์มบันทึกได้
                  </h2>

                  <p className="mt-2 text-sm text-orange-800">
                    สถานะใบเบิกปัจจุบันคือ “{request.status}”
                    แต่ไม่พบหัวใบเคลียร์ในระบบ กรุณาตรวจสอบข้อมูลก่อนบันทึกใหม่
                  </p>
                </section>
              ) : (
                <>
                  <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold">
                      ข้อมูลผู้เคลียร์บิล
                    </h2>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium">
                        วันที่เคลียร์
                        <input
                          type="date"
                          value={clearingDate}
                          onChange={(e) => setClearingDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border px-3 py-2.5"
                        />
                      </label>

                      <label className="block text-sm font-medium">
                        ชื่อผู้เคลียร์
                        <input
                          value={clearerName}
                          onChange={(e) => setClearerName(e.target.value)}
                          placeholder="ชื่อผู้เคลียร์"
                          className="mt-1 w-full rounded-lg border px-3 py-2.5"
                        />
                      </label>

                      <label className="block text-sm font-medium">
                        ตำแหน่ง
                        <input
                          value={clearerPosition}
                          onChange={(e) =>
                            setClearerPosition(e.target.value)
                          }
                          placeholder="ตำแหน่งผู้เคลียร์"
                          className="mt-1 w-full rounded-lg border px-3 py-2.5"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold">
                        รายการค่าใช้จ่าย
                      </h2>

                      <button
                        type="button"
                        onClick={addItem}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                      >
                        + เพิ่มรายการ
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          className="rounded-lg border p-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto] sm:items-end">
                            <label className="block text-sm text-gray-600">
                              รายการที่ {index + 1}
                              <input
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "description",
                                    e.target.value
                                  )
                                }
                                placeholder="เช่น ค่าน้ำมัน"
                                className="mt-1 w-full rounded-lg border px-3 py-2.5"
                              />
                            </label>

                            <label className="block text-sm text-gray-600">
                              จำนวนเงิน
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.amount}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "amount",
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                                className="mt-1 w-full rounded-lg border px-3 py-2.5 text-right"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={items.length === 1}
                              className="rounded-lg border border-red-200 px-3 py-2.5 text-red-600 disabled:opacity-30"
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold">สรุปยอด</h2>

                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between border-b pb-3">
                        <span>เงินที่เบิกรวม</span>
                        <span className="font-semibold">
                          {formatMoney(requestedAmount)} บาท
                        </span>
                      </div>

                      <div className="flex justify-between border-b pb-3">
                        <span>ค่าใช้จ่ายจริง</span>
                        <span className="font-semibold">
                          {formatMoney(totalExpenses)} บาท
                        </span>
                      </div>

                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-semibold">ผลต่าง</span>

                        <span
                          className={`font-bold ${
                            difference > 0
                              ? "text-green-600"
                              : difference < 0
                                ? "text-red-600"
                                : "text-black"
                          }`}
                        >
                          {difference > 0
                            ? `ต้องคืนบริษัท ${formatMoney(difference)} บาท`
                            : difference < 0
                              ? `บริษัทต้องจ่ายเพิ่ม ${formatMoney(
                                  Math.abs(difference)
                                )} บาท`
                              : "ยอดพอดี"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {error && (
                    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="mt-5 pb-10">
                    <button
                      type="button"
                      onClick={saveClearing}
                      disabled={saving || deleting}
                      className="w-full rounded-xl bg-green-600 px-5 py-3.5 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? "กำลังบันทึก..." : "บันทึกใบเคลียร์บิล"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">
            {error}
          </div>
        )}

        <div className="pb-8 print:hidden">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="w-full rounded-xl border bg-white px-5 py-3 font-medium"
          >
            กลับหน้ารายการเคลียร์บิล
          </button>
        </div>
      </div>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: white !important;
            color: #111 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          .print-report,
          .print-report * {
            visibility: visible;
          }

          .print-report {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: #111 !important;
            background: white !important;
            font-family: Arial, Tahoma, sans-serif;
            font-size: 10pt;
            line-height: 1.35;
          }

          .print-report h1 {
            font-size: 16pt;
            margin-bottom: 3mm;
          }

          .print-report h2 {
            font-size: 11pt;
          }

          .print-box {
            border: 1px solid #999;
            border-radius: 2mm;
            padding: 3mm;
            margin-bottom: 3mm;
            break-inside: avoid;
          }

          .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2mm 5mm;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
          }

          .print-table th,
          .print-table td {
            border: 1px solid #aaa;
            padding: 1.5mm 2mm;
            text-align: left;
            overflow-wrap: anywhere;
          }

          .print-table th {
            background: #eee !important;
          }

          .print-table .print-number {
            width: 12mm;
            text-align: center;
          }

          .print-table .print-amount {
            width: 35mm;
            text-align: right;
            white-space: nowrap;
          }

          .print-totals {
            margin-top: 3mm;
            margin-left: auto;
            width: 75%;
          }

          .print-totals p {
            display: flex;
            justify-content: space-between;
            gap: 4mm;
            padding: 1.5mm 0;
            border-bottom: 1px solid #ddd;
          }

          .print-totals p:last-child {
            border-bottom: none;
          }

          button {
            display: none !important;
          }
        }

        @media screen {
          .print-report {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
