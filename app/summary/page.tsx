"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type ExpenseRequest = {
  id: string;
  request_date: string;
  requester_name: string;
  position: string;
  reason: string;
  amount: number | string | null;
  status: string;
};

type ExpenseClearing = {
  id: string;
  request_id: string;
  clearing_date: string;
  clearer_name: string | null;
  requested_amount: number | string | null;
  total_expenses: number | string | null;
  status?: string | null;
};

type PeriodMode = "day" | "month" | "year";

type ClearingRow = {
  clearing: ExpenseClearing;
  request: ExpenseRequest | undefined;
  requested: number;
  actual: number;
  difference: number;
  returned: number;
  shortage: number;
};

const STATUS_CLEARED = "เคลียร์บิลแล้ว";

function money(value: number) {
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function amount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMonthValue(date = new Date()) {
  return localDateValue(date).slice(0, 7);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = value.slice(0, 10);
  const parts = date.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  if (!year || !month || !day) return value;
  return `${day}/${month}/${Number(year) + 543}`;
}

function periodMatches(value: string | null | undefined, mode: PeriodMode, selected: string) {
  if (!value || !selected) return false;
  const date = value.slice(0, 10);

  if (mode === "day") return date === selected;
  if (mode === "month") return date.slice(0, 7) === selected;
  return date.slice(0, 4) === selected;
}

function periodLabel(mode: PeriodMode, selected: string) {
  if (mode === "day") return `วันที่ ${formatDate(selected)}`;

  if (mode === "month") {
    const [year, month] = selected.split("-");
    return `เดือน ${month}/${Number(year) + 543}`;
  }

  return `ปี พ.ศ. ${Number(selected) + 543}`;
}

export default function SummaryPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [clearings, setClearings] = useState<ExpenseClearing[]>([]);
  const [mode, setMode] = useState<PeriodMode>("month");
const [selectedDay, setSelectedDay] = useState("");
const [selectedMonth, setSelectedMonth] = useState("");
const [selectedYear, setSelectedYear] = useState("");
const [dateReady, setDateReady] = useState(false);

useEffect(() => {
  const now = new Date();

  setSelectedDay(localDateValue(now));
  setSelectedMonth(localMonthValue(now));
  setSelectedYear(String(now.getFullYear()));
  setDateReady(true);
}, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [requestResult, clearingResult] = await Promise.all([
      supabase
        .from("expense_requests")
        .select("id,request_date,requester_name,position,reason,amount,status")
        .order("request_date", { ascending: false }),
      supabase
        .from("expense_clearings")
        .select(
          "id,request_id,clearing_date,clearer_name,requested_amount,total_expenses,status"
        )
        .order("clearing_date", { ascending: false }),
    ]);

    if (requestResult.error) {
      setError(`โหลดข้อมูลใบเบิกไม่สำเร็จ: ${requestResult.error.message}`);
      setLoading(false);
      return;
    }

    if (clearingResult.error) {
      setError(
        `โหลดข้อมูลใบเคลียร์ไม่สำเร็จ: ${clearingResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setRequests((requestResult.data ?? []) as ExpenseRequest[]);
    setClearings((clearingResult.data ?? []) as ExpenseClearing[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedValue =
  mode === "day"
    ? selectedDay
    : mode === "month"
      ? selectedMonth
      : selectedYear;

const reportReady = dateReady && Boolean(selectedValue);

  const requestMap = useMemo(() => {
    return new Map(requests.map((request) => [request.id, request]));
  }, [requests]);

  // หนึ่งใบเบิกควรมีใบเคลียร์ที่ตรงกันไม่เกินหนึ่งใบ
  const clearingByRequestId = useMemo(() => {
    const map = new Map<string, ExpenseClearing>();

    for (const clearing of clearings) {
      if (!map.has(clearing.request_id)) {
        map.set(clearing.request_id, clearing);
      }
    }

    return map;
  }, [clearings]);

  // ยอดเงินเบิกยึดวันที่ในใบเบิก
  const periodRequests = useMemo(
  () =>
    reportReady
      ? requests.filter((request) =>
          periodMatches(request.request_date, mode, selectedValue)
        )
      : [],
  [requests, mode, selectedValue, reportReady]
);

const periodClearings = useMemo(
  () =>
    reportReady
      ? clearings.filter((clearing) =>
          periodMatches(clearing.clearing_date, mode, selectedValue)
        )
      : [],
  [clearings, mode, selectedValue, reportReady]
);
  const clearingRows = useMemo<ClearingRow[]>(
    () =>
      periodClearings.map((clearing) => {
        const request = requestMap.get(clearing.request_id);
        const requested = amount(clearing.requested_amount);
        const actual = amount(clearing.total_expenses);

        // หากไม่มีใบเบิกที่ตรงกัน จะไม่คำนวณส่วนต่างให้เป็นเงินคืน/เงินขาด
        const difference = request ? requested - actual : 0;

        return {
          clearing,
          request,
          requested,
          actual,
          difference,
          returned: request ? Math.max(difference, 0) : 0,
          shortage: request ? Math.max(-difference, 0) : 0,
        };
      }),
    [periodClearings, requestMap]
  );

  const advanceTotal = periodRequests.reduce(
    (sum, request) => sum + amount(request.amount),
    0
  );

  const clearingTotal = clearingRows.reduce(
    (sum, row) => sum + row.actual,
    0
  );

  const returnedTotal = clearingRows.reduce(
    (sum, row) => sum + row.returned,
    0
  );

  const shortageTotal = clearingRows.reduce(
    (sum, row) => sum + row.shortage,
    0
  );

  // ค้นหาใบเบิกที่ยังไม่มีใบเคลียร์ โดยอิง request_id
  // รายการนี้แสดงตามวันที่เบิก แม้จะเป็นใบเบิกที่สร้างในอดีตก็ตาม
  const unclearedRequests = useMemo(
    () =>
      periodRequests.filter(
        (request) => !clearingByRequestId.has(request.id)
      ),
    [periodRequests, clearingByRequestId]
  );

  const unclearedTotal = unclearedRequests.reduce(
    (sum, request) => sum + amount(request.amount),
    0
  );

  const unmatchedRows = clearingRows.filter((row) => !row.request);

  function printReport() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              FINANCIAL REPORT
            </p>
            <h1 className="mt-2 text-3xl font-bold">สรุปการเงิน</h1>
            <p className="mt-2 text-sm text-slate-500">
              รายงานเงินเบิก เงินเคลียร์ เงินคืนบริษัท และเงินขาด
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
            >
              ← กลับหน้าแอดมิน
            </button>
            <button
              type="button"
              onClick={printReport}
              disabled={loading || !!error}
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              🖨️ พิมพ์รายงาน
            </button>
          </div>
        </header>

        <section className="no-print mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">เลือกช่วงเวลารายงาน</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">
                ประเภทรายงาน
              </label>
              <select
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as PeriodMode)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
              >
                <option value="day">รายวัน</option>
                <option value="month">รายเดือน</option>
                <option value="year">รายปี</option>
              </select>
            </div>

            {mode === "day" && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  เลือกวันที่
                </label>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(event) => setSelectedDay(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                />
              </div>
            )}

            {mode === "month" && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  เลือกเดือน
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                />
              </div>
            )}

            {mode === "year" && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  เลือกปี ค.ศ.
                </label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                />
                <p className="mt-1 text-xs text-slate-500">
                  ปีที่แสดงในรายงาน: พ.ศ. {Number(selectedYear || 0) + 543}
                </p>
              </div>
            )}

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "กำลังโหลด..." : "↻ โหลดข้อมูลล่าสุด"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">รายงานประจำ</p>
          <h2 className="mt-1 text-2xl font-bold">
            {periodLabel(mode, selectedValue)}
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            เงินเบิกอ้างอิงวันที่เบิก ส่วนเงินเคลียร์ เงินคืนบริษัท
            และเงินขาดอ้างอิงวันที่เคลียร์บิล
          </p>
        </section>

        {loading && (
          <div className="mt-6 rounded-xl bg-white p-8 text-center text-slate-500">
            กำลังโหลดข้อมูลการเงิน...
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-700">โหลดรายงานไม่สำเร็จ</p>
            <p className="mt-2 break-words text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="no-print mt-4 rounded-lg bg-red-600 px-4 py-2 text-white"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-sm font-medium text-blue-800">
                  เงินเบิกในช่วงที่เลือก
                </p>
                <p className="mt-3 text-2xl font-bold text-blue-900">
                  {money(advanceTotal)}
                </p>
                <p className="mt-1 text-xs text-blue-700">บาท</p>
                <p className="mt-3 text-sm text-blue-800">
                  {periodRequests.length} ใบเบิก
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                <p className="text-sm font-medium text-indigo-800">
                  เงินเคลียร์ / ค่าใช้จ่ายจริง
                </p>
                <p className="mt-3 text-2xl font-bold text-indigo-900">
                  {money(clearingTotal)}
                </p>
                <p className="mt-1 text-xs text-indigo-700">บาท</p>
                <p className="mt-3 text-sm text-indigo-800">
                  {periodClearings.length} ใบเคลียร์
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                <p className="text-sm font-medium text-green-800">
                  เงินคืนบริษัท
                </p>
                <p className="mt-3 text-2xl font-bold text-green-900">
                  {money(returnedTotal)}
                </p>
                <p className="mt-1 text-xs text-green-700">บาท</p>
                <p className="mt-3 text-sm text-green-800">
                  เฉพาะใบเคลียร์ที่จับคู่ใบเบิกได้
                </p>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                <p className="text-sm font-medium text-orange-800">
                  เงินขาด / บริษัทต้องจ่ายเพิ่ม
                </p>
                <p className="mt-3 text-2xl font-bold text-orange-900">
                  {money(shortageTotal)}
                </p>
                <p className="mt-1 text-xs text-orange-700">บาท</p>
                <p className="mt-3 text-sm text-orange-800">
                  เฉพาะใบเคลียร์ที่จับคู่ใบเบิกได้
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    รายละเอียดใบเคลียร์ที่จับคู่แล้ว
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    ใช้เลขอ้างอิง request_id จับคู่ใบเบิกกับใบเคลียร์
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {clearingRows.length - unmatchedRows.length} รายการที่จับคู่ได้
                </p>
              </div>

              {clearingRows.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  ไม่มีใบเคลียร์ในช่วงเวลานี้
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="border p-3">วันที่เคลียร์</th>
                        <th className="border p-3">ผู้เบิก</th>
                        <th className="border p-3">เหตุผล</th>
                        <th className="border p-3 text-right">ยอดตามใบเคลียร์</th>
                        <th className="border p-3 text-right">ค่าใช้จ่ายจริง</th>
                        <th className="border p-3 text-right">คืนบริษัท</th>
                        <th className="border p-3 text-right">เงินขาด</th>
                        <th className="no-print border p-3">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clearingRows.map((row) => (
                        <tr key={row.clearing.id} className="hover:bg-slate-50">
                          <td className="border p-3">
                            {formatDate(row.clearing.clearing_date)}
                          </td>
                          <td className="border p-3">
                            {row.request?.requester_name ?? (
                              <span className="font-semibold text-red-600">
                                ไม่พบใบเบิกที่ตรงกัน
                              </span>
                            )}
                          </td>
                          <td className="max-w-xs whitespace-normal break-words border p-3">
                            {row.request?.reason ?? "-"}
                          </td>
                          <td className="border p-3 text-right">
                            {money(row.requested)}
                          </td>
                          <td className="border p-3 text-right">
                            {money(row.actual)}
                          </td>
                          <td className="border p-3 text-right font-semibold text-green-700">
                            {row.request ? money(row.returned) : "-"}
                          </td>
                          <td className="border p-3 text-right font-semibold text-orange-700">
                            {row.request ? money(row.shortage) : "-"}
                          </td>
                          <td className="no-print border p-3">
                            {row.request && (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/clear/${row.request!.id}`)
                                }
                                className="rounded-lg border px-3 py-1.5 hover:bg-slate-100"
                              >
                                เปิดใบเคลียร์
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={3} className="border p-3">
                          รวมเฉพาะรายการที่จับคู่ได้
                        </td>
                        <td className="border p-3 text-right">
                          {money(
                            clearingRows.reduce(
                              (sum, row) =>
                                sum + (row.request ? row.requested : 0),
                              0
                            )
                          )}
                        </td>
                        <td className="border p-3 text-right">
                          {money(clearingTotal)}
                        </td>
                        <td className="border p-3 text-right text-green-700">
                          {money(returnedTotal)}
                        </td>
                        <td className="border p-3 text-right text-orange-700">
                          {money(shortageTotal)}
                        </td>
                        <td className="no-print border p-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {unmatchedRows.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-bold">
                    แจ้งเตือน: พบใบเคลียร์ {unmatchedRows.length} รายการ
                    ที่ไม่มีใบเบิกตรงกัน
                  </p>
                  <p className="mt-1">
                    ระบบไม่นำรายการเหล่านี้ไปคำนวณเงินคืนบริษัทหรือเงินขาด
                    เพื่อป้องกันยอดผิดพลาด กรุณาตรวจสอบ request_id ในฐานข้อมูล
                  </p>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-xl font-bold">
                  ใบเบิกที่ยังไม่มีใบเคลียร์
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  คัดกรองจากใบเบิกที่อยู่ในช่วงวันที่เลือก และยังไม่มีรายการ
                  expense_clearings ที่ตรงกับ request_id
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-orange-50 p-4">
                <p className="text-sm text-orange-800">
                  ยอดเงินเบิกที่ยังไม่มีใบเคลียร์ในช่วงนี้
                </p>
                <p className="mt-1 text-2xl font-bold text-orange-900">
                  {money(unclearedTotal)} บาท
                </p>
                <p className="mt-1 text-sm text-orange-800">
                  {unclearedRequests.length} รายการ
                </p>
              </div>

              {unclearedRequests.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  ไม่มีใบเบิกค้างเคลียร์ในช่วงนี้
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="border p-3">วันที่เบิก</th>
                        <th className="border p-3">ผู้เบิก</th>
                        <th className="border p-3">เหตุผล</th>
                        <th className="border p-3">สถานะ</th>
                        <th className="border p-3 text-right">ยอดเงินเบิก</th>
                        <th className="no-print border p-3">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unclearedRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-slate-50">
                          <td className="border p-3">
                            {formatDate(request.request_date)}
                          </td>
                          <td className="border p-3">
                            {request.requester_name}
                          </td>
                          <td className="max-w-xs whitespace-normal break-words border p-3">
                            {request.reason}
                          </td>
                          <td className="border p-3">{request.status}</td>
                          <td className="border p-3 text-right font-semibold">
                            {money(amount(request.amount))}
                          </td>
                          <td className="no-print border p-3">
                            <button
                              type="button"
                              onClick={() => router.push(`/clear/${request.id}`)}
                              className="rounded-lg border px-3 py-1.5 hover:bg-slate-100"
                            >
                              เปิดใบเบิก
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <footer className="mt-6 text-xs text-slate-500">
              <p>
                หมายเหตุ: เงินคืนบริษัท = ยอดเงินเบิกตามใบเคลียร์ − ค่าใช้จ่ายจริง
                เมื่อผลต่างมากกว่า 0
              </p>
              <p className="mt-1">
                เงินขาด = ค่าใช้จ่ายจริง − ยอดเงินเบิกตามใบเคลียร์
                เมื่อผลต่างมากกว่า 0
              </p>
              <p className="mt-1">
                ยอดเงินเบิกและยอดเงินเคลียร์ใช้วันที่คนละประเภท
                จึงไม่ควรนำยอดรวมของสองหมวดมาหักลบเพื่อสรุปเงินคืนหรือเงินขาด
              </p>
            </footer>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }

          body {
            background: #fff !important;
            color: #000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          main {
            min-height: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          main > div {
            max-width: none !important;
            margin: 0 !important;
          }

          section,
          article,
          table {
            break-inside: avoid;
          }

          table {
            font-size: 10px !important;
          }

          th,
          td {
            padding: 5px !important;
          }
        }
      `}</style>
    </main>
  );
}