
const menuItems = [
  {
    number: "01",
    title: "เบิกเงิน",
    description: "สร้างใบเบิกเงินล่วงหน้า",
    detail: "สำหรับพนักงานที่ต้องการเบิกเงินไปใช้ในการทำงาน",
    href: "/request",
    icon: "＋",
    color: "bg-blue-600",
    hover: "hover:bg-blue-700",
  },
  {
    number: "02",
    title: "เคลียร์บิล",
    description: "บันทึกค่าใช้จ่ายและคืนเงิน",
    detail: "เลือกรายการใบเบิกที่ต้องการเคลียร์ค่าใช้จ่าย",
    href: "/clear",
    icon: "฿",
    color: "bg-emerald-600",
    hover: "hover:bg-emerald-700",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5 sm:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white">
            ฿
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              ระบบใบเบิกเงิน
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              ระบบเบิกเงินและเคลียร์ค่าใช้จ่าย
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-700">
            EXPENSE MANAGEMENT
          </p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            สวัสดีครับ 👋
          </h2>
          <p className="mt-3 leading-7 text-slate-500">
            เลือกรายการที่ต้องการใช้งานได้เลย
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {menuItems.map((item) => (
            <a
              key={item.number}
              href={item.href}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-8"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-bold text-white ${item.color} ${item.hover}`}
                >
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-slate-400">
                  {item.number}
                </span>
              </div>

              <h3 className="mt-7 text-2xl font-bold">{item.title}</h3>
              <p className="mt-2 font-medium text-slate-700">
                {item.description}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.detail}
              </p>

              <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-sm font-semibold text-slate-700">
                  เข้าใช้งาน
                </span>
                <span className="text-xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900">
                  →
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-semibold">หมายเหตุ</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            เมื่อสร้างใบเบิกแล้ว สามารถติดตามสถานะและกลับมาเคลียร์ค่าใช้จ่ายได้ภายหลัง
          </p>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-400">
          ระบบใบเบิกเงิน • Internal Expense System
        </footer>
      </section>
    </main>
  );
}
