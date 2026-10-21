
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

type AdvanceRequest = {
  parent_request_id: string;
  amount: number;
};

export default function ClearPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [approvedAdvanceTotals, setApprovedAdvanceTotals] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("expense_requests")
      .select("*")
      .eq("status", "รอเคลียร์")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    const loadedRequests = (data || []) as ExpenseRequest[];
    setRequests(loadedRequests);

    const totals: Record<string, number> = {};

    if (loadedRequests.length > 0) {
      const requestIds = loadedRequests.map((request) => request.id);

      const { data: advanceData, error: advanceError } = await supabase
        .from("expense_advance_requests")
        .select("parent_request_id, amount")
        .in("parent_request_id", requestIds)
        .eq("status", "อนุมัติแล้ว");

      if (advanceError) {
        console.error(advanceError);
        setError(
          "โหลดรายการใบเบิกได้ แต่ไม่สามารถโหลดรายการเบิกเพิ่มที่อนุมัติแล้วได้: " +
            advanceError.message
        );
        setLoading(false);
        return;
      }

      ((advanceData || []) as AdvanceRequest[]).forEach((advance) => {
        const requestId = advance.parent_request_id;
        totals[requestId] =
          (totals[requestId] || 0) + Number(advance.amount || 0);
      });
    }

    setApprovedAdvanceTotals(totals);
    setLoading(false);
  }

  function formatMoney(amount: number) {
    return Number(amount).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function openClearing(requestId: string) {
    router.push(`/clear/${requestId}?from=technician&mode=clear`);
  }

  function openAdvanceRequest(requestId: string) {
    router.push(`/clear/${requestId}?from=technician&mode=advance`);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-4xl">
        {/* ปุ่มกลับหน้าหลัก */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          ← กลับหน้าหลัก
        </button>

        {/* หัวข้อ */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">เคลียร์บิล</h1>

          <p className="mt-1 text-sm text-gray-500">
            เลือกใบเบิกเพื่อเคลียร์บิลหรือขอเบิกเงินเพิ่ม
          </p>
        </div>

        {/* กำลังโหลด */}
        {loading && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-gray-500">กำลังโหลดรายการใบเบิก...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-700">
              ไม่สามารถโหลดข้อมูลได้
            </p>

            <p className="mt-2 text-sm text-red-600">{error}</p>

            <button
              type="button"
              onClick={loadRequests}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* ไม่มีใบเบิก */}
        {!loading && !error && requests.length === 0 && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">📋</div>

            <h2 className="mt-3 text-lg font-semibold text-gray-800">
              ไม่มีใบเบิกที่รอเคลียร์
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              เมื่อมีใบเบิกที่รอเคลียร์ รายการจะมาแสดงที่หน้านี้
            </p>
          </div>
        )}

        {/* รายการใบเบิก */}
        {!loading && !error && requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((request) => {
              const approvedAdvanceTotal =
                approvedAdvanceTotals[request.id] || 0;

              const totalRequested =
                Number(request.amount || 0) + approvedAdvanceTotal;

              return (
                <div
                  key={request.id}
                  className="rounded-xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* ข้อมูลใบเบิก */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />

                        <span className="text-sm font-semibold text-red-600">
                          รอเคลียร์
                        </span>
                      </div>

                      <h2 className="mt-2 text-lg font-bold text-gray-900">
                        {request.requester_name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        {request.position}
                      </p>

                      <div className="mt-3 space-y-1 text-sm text-gray-700">
                        <p>
                          <span className="font-medium">วันที่เบิก:</span>{" "}
                          {formatDate(request.request_date)}
                        </p>

                        <p>
                          <span className="font-medium">เหตุผล:</span>{" "}
                          {request.reason}
                        </p>
                      </div>
                    </div>

                    {/* จำนวนเงินและปุ่มดำเนินการ */}
                    <div className="sm:min-w-[210px] sm:text-right">
                      <p className="text-sm text-gray-500">
                        จำนวนเงินเบิกรวม
                      </p>

                      <p className="mt-1 text-2xl font-bold text-gray-900">
                        {formatMoney(totalRequested)}
                      </p>

                      {approvedAdvanceTotal > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-gray-500">
                          <p>
                            ยอดใบเบิกแรก: {formatMoney(Number(request.amount || 0))} บาท
                          </p>
                          <p className="text-green-700">
                            เบิกเพิ่มที่อนุมัติแล้ว:{" "}
                            {formatMoney(approvedAdvanceTotal)} บาท
                          </p>
                        </div>
                      )}

                      
<div className="mt-3 flex flex-row justify-end gap-2">
  <button
    type="button"
    onClick={() => openClearing(request.id)}
    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
  >
    เคลียร์บิล
  </button>

  <button
    type="button"
    onClick={() => openAdvanceRequest(request.id)}
    className="rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
  >
    เบิกเงินเพิ่ม
  </button>
</div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
