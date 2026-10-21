
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
  admin_seen_at?: string | null;
};

type ClearingSummary = {
  id: string;
  request_id: string;
  clearing_date: string;
  clearer_name: string;
  clearer_position: string;
  total_expenses: number | string | null;
  requested_amount: number | string | null;
  status: string;
};

type AdvanceRequest = {
  id: string;
  parent_request_id: string;
  advance_date?: string | null;
  amount: number | string;
  reason: string;
  status: string;
  requested_by: string;
  requested_at: string;
  created_at?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
};

const STATUS_NEW = "ใบเบิกใหม่";
const STATUS_WAITING = "รอเคลียร์";
const STATUS_REVIEW = "รอตรวจสอบ";
const STATUS_LEGACY_REFUND = "รอรับเงินคืน";
const STATUS_CLEARED = "เคลียร์บิลแล้ว";

type Category = "all" | "new" | "waiting" | "review" | "cleared" | "advance";

type CardColor = "red" | "orange" | "purple" | "green" | "blue" | "amber";

export default function AdminPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [clearings, setClearings] = useState<ClearingSummary[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [reviewingAdvanceId, setReviewingAdvanceId] = useState<string | null>(null);
  const [expandedAdvanceId, setExpandedAdvanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [activeTab, setActiveTab] = useState<Category>("all");
  const [selectedRequest, setSelectedRequest] = useState<ExpenseRequest | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError("");

    const [requestResult, clearingResult, advanceResult] = await Promise.all([
      supabase
        .from("expense_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("expense_clearings").select("*"),
      supabase
        .from("expense_advance_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (requestResult.error) {
      setError(requestResult.error.message);
      setLoading(false);
      return;
    }

    setRequests((requestResult.data || []) as ExpenseRequest[]);

    if (clearingResult.error) {
      console.error("โหลดใบเคลียร์บิลไม่สำเร็จ:", clearingResult.error);
      setClearings([]);
      setActionMessage(
        "โหลดใบเบิกได้ แต่ไม่สามารถอ่านข้อมูลใบเคลียร์บิล กรุณาตรวจสอบสิทธิ์ตาราง expense_clearings"
      );
    } else {
      setClearings((clearingResult.data || []) as ClearingSummary[]);
      setActionMessage("");
    }

    if (advanceResult.error) {
      console.error("โหลดข้อมูลเงินเบิกเพิ่มไม่สำเร็จ:", advanceResult.error);
      setAdvances([]);
      setError(`โหลดข้อมูลเงินเบิกเพิ่มไม่สำเร็จ: ${advanceResult.error.message}`);
    } else {
      setAdvances((advanceResult.data || []) as AdvanceRequest[]);
    }

    setLoading(false);
  }

  function formatMoney(amount: number) {
    return Number(amount || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(date: string) {
    if (!date) return "-";
    const dateOnly = date.slice(0, 10);
    const [year, month, day] = dateOnly.split("-");
    if (!year || !month || !day) return "-";
    return `${day}/${month}/${Number(year) + 543}`;
  }

  function formatDateTime(date: string) {
    if (!date) return "-";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "-";

    return parsed.toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  const newRequests = requests.filter((r) => r.status === STATUS_NEW);
  const waitingRequests = requests.filter((r) => r.status === STATUS_WAITING);

  // รองรับข้อมูลเก่าที่เคยใช้สถานะ "รอรับเงินคืน"
  // โดยรวมเข้าหมวดรอตรวจสอบ ไม่แสดงเป็นสถานะแยกอีกต่อไป
  const reviewRequests = requests.filter(
    (r) => r.status === STATUS_REVIEW || r.status === STATUS_LEGACY_REFUND
  );

  const clearedRequests = requests.filter((r) => r.status === STATUS_CLEARED);

  const pendingAdvances = advances.filter((a) => a.status === "รออนุมัติ");

  const visibleRequests =
    activeTab === "all"
      ? requests
      : activeTab === "new"
        ? newRequests
        : activeTab === "waiting"
          ? waitingRequests
          : activeTab === "review"
            ? reviewRequests
            : activeTab === "cleared"
              ? clearedRequests
              : [];

  function getApprovedAdvanceAmount(requestId: string) {
    return advances
      .filter(
        (a) =>
          a.parent_request_id === requestId &&
          a.status === "อนุมัติแล้ว"
      )
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }

  function getClearing(requestId: string) {
    return clearings.find((c) => c.request_id === requestId);
  }

  // ผลต่าง = ยอดเงินที่เบิกรวม - ค่าใช้จ่ายจริง
  // บวก = เงินเหลือ, ลบ = บริษัทต้องจ่ายเพิ่ม, ศูนย์ = พอดี
  function getDifference(clearing: ClearingSummary) {
    return (
      Number(clearing.requested_amount || 0) -
      Number(clearing.total_expenses || 0)
    );
  }

  function getRequestTotal(request: ExpenseRequest) {
    const savedClearing = getClearing(request.id);

    if (
      savedClearing &&
      (request.status === STATUS_CLEARED ||
        request.status === STATUS_REVIEW ||
        request.status === STATUS_LEGACY_REFUND)
    ) {
      return Number(savedClearing.requested_amount || 0);
    }

    return Number(request.amount || 0) + getApprovedAdvanceAmount(request.id);
  }

  const pendingAmount = [...newRequests, ...waitingRequests].reduce(
    (sum, request) => sum + getRequestTotal(request),
    0
  );

  const requestedTotal = requests.reduce(
    (sum, request) => sum + getRequestTotal(request),
    0
  );

  const clearedActualTotal = clearings.reduce(
    (sum, clearing) => sum + Number(clearing.total_expenses || 0),
    0
  );

  const clearedRequestedTotal = clearedRequests.reduce(
    (sum, request) => sum + getRequestTotal(request),
    0
  );

  const differenceTotal = clearedRequestedTotal - clearedActualTotal;

  async function deleteRequest(request: ExpenseRequest) {
    if (request.status !== STATUS_NEW) {
      setError("ลบได้เฉพาะใบเบิกใหม่ที่ยังไม่ได้รับทราบ");
      return;
    }

    const confirmed = window.confirm(
      `ยืนยันลบใบเบิกของ ${request.requester_name} จำนวน ${formatMoney(
        request.amount
      )} บาท ใช่หรือไม่?\n\nเมื่อลบแล้วจะไม่สามารถกู้คืนผ่านหน้าเว็บได้`
    );

    if (!confirmed) return;

    setError("");
    setActionMessage("");

    const { data, error } = await supabase
      .from("expense_requests")
      .delete()
      .eq("id", request.id)
      .eq("status", STATUS_NEW)
      .select("id")
      .maybeSingle();

    if (error) {
      setError(`ลบใบเบิกไม่สำเร็จ: ${error.message}`);
      return;
    }

    if (!data) {
      setError("ลบไม่ได้ รายการอาจได้รับการรับทราบไปแล้ว หรือมีข้อมูลที่เกี่ยวข้อง");
      await loadRequests();
      return;
    }

    setActionMessage(`ลบใบเบิกของ ${request.requester_name} เรียบร้อยแล้ว`);
    await loadRequests();
  }

  async function acknowledgeRequest() {
    if (!selectedRequest || confirming) return;

    const confirmed = window.confirm(
      `ยืนยันรับทราบใบเบิกของ ${selectedRequest.requester_name} จำนวน ${formatMoney(
        selectedRequest.amount
      )} บาท ใช่หรือไม่?`
    );

    if (!confirmed) return;

    setConfirming(true);
    setError("");
    setActionMessage("");

    const { data, error } = await supabase
      .from("expense_requests")
      .update({
        status: STATUS_WAITING,
        admin_seen_at: new Date().toISOString(),
      })
      .eq("id", selectedRequest.id)
      .eq("status", STATUS_NEW)
      .select("id")
      .maybeSingle();

    if (error) {
      setError(`รับทราบใบเบิกไม่สำเร็จ: ${error.message}`);
      setConfirming(false);
      return;
    }

    if (!data) {
      setError("รายการนี้อาจถูกดำเนินการไปแล้ว กรุณาโหลดข้อมูลใหม่แล้วตรวจสอบสถานะ");
      setConfirming(false);
      return;
    }

    setSelectedRequest(null);
    setActiveTab("waiting");
    setActionMessage("รับทราบใบเบิกแล้ว รายการย้ายไปหมวดรอเคลียร์บิล");
    setConfirming(false);
    await loadRequests();
  }

  async function reviewAdvance(advance: AdvanceRequest, approved: boolean) {
    if (reviewingAdvanceId) return;

    let reviewNote = "";

    if (!approved) {
      const note = window.prompt(
        `ระบุเหตุผลที่ปฏิเสธเงินเบิกเพิ่ม ${formatMoney(Number(advance.amount))} บาท`,
        ""
      );

      if (note === null) return;
      reviewNote = note.trim();

      if (!reviewNote) {
        setError("กรุณาระบุเหตุผลที่ปฏิเสธรายการเบิกเพิ่ม");
        return;
      }
    } else {
      const confirmed = window.confirm(
        `ยืนยันอนุมัติเงินเบิกเพิ่ม ${formatMoney(
          Number(advance.amount)
        )} บาท?\n\nเหตุผล: ${advance.reason}`
      );

      if (!confirmed) return;
    }

    setReviewingAdvanceId(advance.id);
    setError("");
    setActionMessage("");

    const { error } = await supabase.rpc("review_expense_advance", {
      p_advance_id: advance.id,
      p_approved: approved,
      p_reviewed_by: "แอดมิน",
      p_review_note: reviewNote || null,
    });

    if (error) {
      setError(`บันทึกผลการตรวจเงินเบิกเพิ่มไม่สำเร็จ: ${error.message}`);
      setReviewingAdvanceId(null);
      return;
    }

    setActionMessage(
      approved
        ? `อนุมัติเงินเบิกเพิ่ม ${formatMoney(Number(advance.amount))} บาทแล้ว`
        : `ปฏิเสธเงินเบิกเพิ่ม ${formatMoney(Number(advance.amount))} บาทแล้ว`
    );
    setReviewingAdvanceId(null);
    await loadRequests();
  }

  function advanceStatusClass(status: string) {
    if (status === "อนุมัติแล้ว") return "bg-green-100 text-green-700";
    if (status === "ปฏิเสธแล้ว") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-800";
  }

  function getRequestName(requestId: string) {
    return (
      requests.find((r) => r.id === requestId)?.requester_name ||
      "ไม่พบชื่อผู้เบิก"
    );
  }

  function getParentRequest(advance: AdvanceRequest) {
    return requests.find((r) => r.id === advance.parent_request_id);
  }

  function getAdvanceDate(advance: AdvanceRequest) {
    return advance.advance_date || advance.requested_at || advance.created_at || "";
  }

  function statusClass(status: string) {
    if (status === STATUS_CLEARED) return "bg-green-100 text-green-700";
    if (status === STATUS_WAITING) return "bg-orange-100 text-orange-700";
    if (status === STATUS_REVIEW || status === STATUS_LEGACY_REFUND) {
      return "bg-purple-100 text-purple-700";
    }
    if (status === STATUS_NEW) return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-700";
  }

  function displayStatus(status: string) {
    return status === STATUS_LEGACY_REFUND ? STATUS_REVIEW : status;
  }

  function openRequest(request: ExpenseRequest) {
    if (request.status === STATUS_NEW) {
      setSelectedRequest(request);
      return;
    }

    router.push(`/clear/${request.id}?from=admin&mode=clear`);
  }

  const categoryCards: {
    id: Category;
    title: string;
    count: number;
    color: CardColor;
  }[] = [
    {
      id: "new",
      title: "🔴 ใบเบิกใหม่",
      count: newRequests.length + pendingAdvances.length,
      color: "red",
    },
    {
      id: "waiting",
      title: "🟠 รอเคลียร์บิล",
      count: waitingRequests.length,
      color: "orange",
    },
    {
      id: "review",
      title: "🟣 รอตรวจสอบ",
      count: reviewRequests.length,
      color: "purple",
    },
    {
      id: "cleared",
      title: "🟢 เคลียร์บิลแล้ว",
      count: clearedRequests.length,
      color: "green",
    },
  ];

  const cardColors: Record<
    CardColor,
    { active: string; inactive: string; title: string; count: string }
  > = {
    red: {
      active: "border-red-400 bg-red-50 ring-2 ring-red-200",
      inactive: "border-red-200 bg-white hover:bg-red-50",
      title: "text-red-600",
      count: "text-red-600",
    },
    orange: {
      active: "border-orange-400 bg-orange-50 ring-2 ring-orange-200",
      inactive: "border-orange-200 bg-white hover:bg-orange-50",
      title: "text-orange-600",
      count: "text-orange-600",
    },
    purple: {
      active: "border-purple-400 bg-purple-50 ring-2 ring-purple-200",
      inactive: "border-purple-200 bg-white hover:bg-purple-50",
      title: "text-purple-600",
      count: "text-purple-600",
    },
    amber: {
      active: "border-amber-400 bg-amber-50 ring-2 ring-amber-200",
      inactive: "border-amber-200 bg-white hover:bg-amber-50",
      title: "text-amber-700",
      count: "text-amber-700",
    },
    green: {
      active: "border-green-400 bg-green-50 ring-2 ring-green-200",
      inactive: "border-green-200 bg-white hover:bg-green-50",
      title: "text-green-600",
      count: "text-green-600",
    },
    blue: {
      active: "border-blue-400 bg-blue-50 ring-2 ring-blue-200",
      inactive: "border-blue-200 bg-white hover:bg-blue-50",
      title: "text-blue-600",
      count: "text-blue-600",
    },
  };

  const activeCategoryTitle: Record<Category, string> = {
    all: "📋 รายการใบเบิกทั้งหมด",
    new: "🔴 รายการใบเบิกใหม่และคำขอเบิกเงินเพิ่ม",
    waiting: "🟠 รายการรอเคลียร์บิล",
    review: "🟣 รายการรอตรวจสอบ",
    cleared: "🟢 รายการเคลียร์บิลแล้ว",
    advance: "💰 รายการขอเบิกเงินเพิ่ม",
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              EXPENSE MANAGEMENT
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              ระบบบริหารเงินทดรองจ่ายและเคลียร์ค่าใช้จ่าย
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              จัดการใบเบิกเงินและตรวจสอบสถานะการเคลียร์บิล
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/summary")}
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            📊 สรุปการเงิน
          </button>
        </header>

        {/* การ์ดหมวดรายการ: รวมคำขอเบิกเงินเพิ่มไว้ในใบเบิกใหม่ */}
        <section className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {categoryCards.map((card) => {
            const colors = cardColors[card.color];
            const isActive = activeTab === card.id;

            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveTab(card.id);
                  setSelectedRequest(null);
                  setError("");
                  setActionMessage("");
                  setExpandedAdvanceId(null);
                }}
                className={`min-w-0 rounded-xl border p-3 text-left shadow-sm transition ${
                  isActive ? colors.active : colors.inactive
                }`}
              >
                <p className={`text-sm font-semibold leading-snug ${colors.title}`}>
                  {card.title}
                </p>
                <p className={`mt-2 text-2xl font-bold ${colors.count}`}>
                  {card.count}
                </p>
                {card.id === "new" && (
                  <p className="mt-1 text-xs text-slate-500">
                    รวมเบิกปกติและเบิกเพิ่ม
                  </p>
                )}
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={activeTab === "all"}
            onClick={() => {
              setActiveTab("all");
              setSelectedRequest(null);
              setError("");
              setActionMessage("");
              setExpandedAdvanceId(null);
            }}
            className={`min-w-0 rounded-xl border p-3 text-left shadow-sm transition ${
              activeTab === "all"
                ? cardColors.blue.active
                : cardColors.blue.inactive
            }`}
          >
            <p className={`text-sm font-semibold leading-snug ${cardColors.blue.title}`}>
              📋 ใบเบิกทั้งหมด
            </p>
            <p className={`mt-2 text-2xl font-bold ${cardColors.blue.count}`}>
              {requests.length}
            </p>
          </button>
        </section>

        {/* สรุปยอดเงิน */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">สรุปยอดเงิน</h2>
            <button
              type="button"
              onClick={() => void loadRequests()}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              ↻ โหลดข้อมูลใหม่
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-slate-600">ยอดเงินตามใบเบิกทั้งหมด</p>
              <p className="mt-2 text-xl font-bold text-blue-700">
                {formatMoney(requestedTotal)} บาท
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-sm text-slate-600">ยอดใบเบิกที่ยังรอเคลียร์</p>
              <p className="mt-2 text-xl font-bold text-orange-700">
                {formatMoney(pendingAmount)} บาท
              </p>
            </div>
            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-sm text-slate-600">ค่าใช้จ่ายจริงที่เคลียร์แล้ว</p>
              <p className="mt-2 text-xl font-bold text-green-700">
                {formatMoney(clearedActualTotal)} บาท
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-600">ส่วนต่างของใบที่เคลียร์แล้ว</p>
              <p
                className={`mt-2 text-xl font-bold ${
                  differenceTotal < 0
                    ? "text-red-600"
                    : differenceTotal > 0
                      ? "text-green-600"
                      : "text-slate-800"
                }`}
              >
                {formatMoney(differenceTotal)} บาท
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            ส่วนต่างรวมคำนวณจากยอดเงินที่เบิกทั้งหมดลบด้วยค่าใช้จ่ายจริง
          </p>
        </section>

        {/* รายการตามหมวดที่เลือก */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {activeCategoryTitle[activeTab]}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeTab === "new"
                  ? `ใบเบิกปกติ ${newRequests.length} รายการ · คำขอเบิกเงินเพิ่มรออนุมัติ ${pendingAdvances.length} รายการ`
                  : `แสดง ${visibleRequests.length} รายการ`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              ↻ โหลดข้อมูลใหม่
            </button>
          </div>

          {actionMessage && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {actionMessage}
            </div>
          )}

          {loading && (
            <div className="mt-5 py-6 text-center text-sm text-slate-500">
              กำลังโหลดข้อมูล...
            </div>
          )}

          {!loading && error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-700">มีข้อผิดพลาด</p>
              <p className="mt-2 break-words text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void loadRequests()}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}

          {/* คำขอเบิกเงินเพิ่มที่รออนุมัติ แสดงในหมวดใบเบิกใหม่ */}
          {!loading && !error && activeTab === "new" && pendingAdvances.length > 0 && (
            <div className="mt-5 space-y-4">
              {pendingAdvances.map((advance) => {
                const parentRequest = getParentRequest(advance);
                const isExpanded = expandedAdvanceId === advance.id;
                const isReviewing = reviewingAdvanceId === advance.id;

                return (
                  <article
                    key={`advance-${advance.id}`}
                    className="rounded-2xl border border-amber-300 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            💰 ขอเบิกเงินเพิ่ม
                          </span>
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            รออนุมัติ
                          </span>
                          <span className="text-xs font-bold text-amber-700">
                            ใหม่
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-bold">
                          {advance.requested_by || getRequestName(advance.parent_request_id)}
                        </h3>

                        <div className="mt-3 space-y-1 text-sm">
                          <p>
                            <span className="font-medium">วันที่ขอเบิกเพิ่ม:</span>{" "}
                            {formatDate(getAdvanceDate(advance))}
                          </p>
                          <p className="break-words">
                            <span className="font-medium">เหตุผล:</span>{" "}
                            {advance.reason || "-"}
                          </p>
                          <p>
                            <span className="font-medium">ใบเบิกต้นทาง:</span>{" "}
                            {parentRequest
                              ? `${parentRequest.requester_name} (${displayStatus(parentRequest.status)})`
                              : "ไม่พบใบเบิกต้นทาง"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAdvanceId(isExpanded ? null : advance.id)
                          }
                          className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          {isExpanded ? "ซ่อนรายละเอียดใบเบิกต้นทาง" : "ดูรายละเอียดใบเบิกต้นทาง"}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
                            <p>
                              <span className="font-semibold">ชื่อผู้เบิกต้นทาง:</span>{" "}
                              {parentRequest?.requester_name || "-"}
                            </p>
                            <p className="mt-1">
                              <span className="font-semibold">ตำแหน่ง:</span>{" "}
                              {parentRequest?.position || "-"}
                            </p>
                            <p className="mt-1">
                              <span className="font-semibold">วันที่ใบเบิก:</span>{" "}
                              {parentRequest
                                ? formatDate(parentRequest.request_date)
                                : "-"}
                            </p>
                            <p className="mt-1 break-words">
                              <span className="font-semibold">เหตุผลใบเบิกเดิม:</span>{" "}
                              {parentRequest?.reason || "-"}
                            </p>
                            <p className="mt-1">
                              <span className="font-semibold">สถานะใบเบิกเดิม:</span>{" "}
                              {parentRequest
                                ? displayStatus(parentRequest.status)
                                : "-"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="sm:min-w-44 sm:text-right">
                        <p className="text-sm text-slate-500">
                          จำนวนเงินที่ขอเบิกเพิ่ม
                        </p>
                        <p className="mt-1 text-2xl font-bold text-amber-700">
                          {formatMoney(Number(advance.amount))} บาท
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => void reviewAdvance(advance, true)}
                            disabled={Boolean(reviewingAdvanceId)}
                            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isReviewing ? "กำลังบันทึก..." : "อนุมัติ"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewAdvance(advance, false)}
                            disabled={Boolean(reviewingAdvanceId)}
                            className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading &&
            !error &&
            activeTab !== "advance" &&
            visibleRequests.length === 0 &&
            !(activeTab === "new" && pendingAdvances.length > 0) && (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                ไม่มีรายการในหมวดนี้
              </p>
            )}

          {!loading && !error && activeTab !== "advance" && visibleRequests.length > 0 && (
            <div className="mt-5 space-y-4">
              {visibleRequests.map((request) => {
                const clearing = getClearing(request.id);
                const difference = clearing ? getDifference(clearing) : 0;
                const isReview =
                  request.status === STATUS_REVIEW ||
                  request.status === STATUS_LEGACY_REFUND;

                return (
                  <article
                    key={request.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                      request.status === STATUS_NEW
                        ? "border-red-200"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                              request.status
                            )}`}
                          >
                            {displayStatus(request.status)}
                          </span>
                          {request.status === STATUS_NEW && (
                            <>
                              <span className="text-xs font-bold text-red-600">
                                🔴 ใหม่
                              </span>
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                ใบเบิกปกติ
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="mt-3 text-lg font-bold">
                          {request.requester_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {request.position}
                        </p>
                        <div className="mt-3 space-y-1 text-sm">
                          <p>
                            <span className="font-medium">วันที่เบิก:</span>{" "}
                            {formatDate(request.request_date)}
                          </p>
                          <p className="break-words">
                            <span className="font-medium">เหตุผล:</span>{" "}
                            {request.reason}
                          </p>
                        </div>

                        {getApprovedAdvanceAmount(request.id) > 0 && (
                          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                            รวมเงินเบิกเพิ่มที่อนุมัติแล้ว{" "}
                            {formatMoney(getApprovedAdvanceAmount(request.id))} บาท
                          </p>
                        )}
                      </div>

                      <div className="sm:min-w-44 sm:text-right">
                        <p className="text-sm text-slate-500">
                          {request.status === STATUS_CLEARED
                            ? "ยอดเงินตามใบเคลียร์"
                            : "จำนวนเงินที่เบิกรวม"}
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {formatMoney(getRequestTotal(request))} บาท
                        </p>

                        {request.status === STATUS_NEW ? (
                          <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(request)}
                              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                            >
                              เปิดตรวจสอบใบเบิก
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => openRequest(request)}
                              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                            >
                              ดูรายละเอียด
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isReview && clearing && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="text-sm text-slate-600">
                          ค่าใช้จ่ายจริง{" "}
                          {formatMoney(Number(clearing.total_expenses || 0))} บาท
                        </p>
                        {difference > 0 ? (
                          <p className="mt-1 text-sm font-semibold text-green-600">
                            เงินคงเหลือ {formatMoney(difference)} บาท
                          </p>
                        ) : difference < 0 ? (
                          <p className="mt-1 text-sm font-semibold text-red-600">
                            บริษัทต้องจ่ายเพิ่ม{" "}
                            {formatMoney(Math.abs(difference))} บาท
                          </p>
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            ยอดเงินพอดี
                          </p>
                        )}
                      </div>
                    )}

                    {isReview && !clearing && (
                      <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                        ไม่พบข้อมูลใบเคลียร์บิล จึงยังยืนยันไม่ได้ กรุณาเปิดใบเคลียร์เพื่อตรวจสอบ
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* หน้าต่างตรวจสอบและรับทราบใบเบิก */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-600">
                    🔴 ตรวจสอบใบเบิกใหม่
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {selectedRequest.requester_name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>

              <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <p>
                  <span className="font-semibold">ตำแหน่ง:</span>{" "}
                  {selectedRequest.position || "-"}
                </p>
                <p>
                  <span className="font-semibold">วันที่เบิก:</span>{" "}
                  {formatDate(selectedRequest.request_date)}
                </p>
                <p className="break-words">
                  <span className="font-semibold">เหตุผลในการเบิก:</span>{" "}
                  {selectedRequest.reason || "-"}
                </p>
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-slate-500">จำนวนเงินที่ขอเบิก</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {formatMoney(selectedRequest.amount)} บาท
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                เมื่อตกลงรับทราบแล้ว ใบเบิกนี้จะย้ายไปหมวด “รอเคลียร์บิล”
              </p>

              <button
                type="button"
                onClick={() => void deleteRequest(selectedRequest)}
                disabled={confirming}
                className="mt-5 w-full rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                ลบใบเบิกนี้
              </button>

              <button
                type="button"
                onClick={() => void acknowledgeRequest()}
                disabled={confirming}
                className="mt-3 w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {confirming ? "กำลังบันทึก..." : "ตกลง / รับทราบใบเบิก"}
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
