"use server";

// LIFF 點餐頁面用的 Server Actions。
//
// ⚠️ 安全性簡化說明（已記錄於 docs/PROGRESS.md）：這裡信任前端用
// liff.getProfile() 拿到的 lineUserId，沒有再用 liff.getIDToken() 做
// 伺服器端 JWT 簽章驗證。這跟計劃文件描述的「用 userId 比對員工名冊」
// 一致，但嚴格來說前端送上來的 lineUserId 理論上可以被偽造。對內部
// MVP 而言風險可接受，未來若要強化，可以加上 ID Token 驗證這一層。
import {
  findEmployeeByLineUserId,
  listUnboundEmployees,
  bindEmployeeToLine,
  type Employee,
} from "@/lib/data/employees";
import { getMenu, type Menu } from "@/lib/data/menus";
import { getOrder, upsertOrder, cancelOrder, type Order } from "@/lib/data/orders";

export async function getEmployeeByLineUserIdAction(lineUserId: string): Promise<Employee | null> {
  const employee = await findEmployeeByLineUserId(lineUserId);
  return employee ?? null;
}

export async function getUnboundEmployeesAction(): Promise<Employee[]> {
  return listUnboundEmployees();
}

export async function bindEmployeeAction(
  employeeId: string,
  lineUserId: string
): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  return bindEmployeeToLine(employeeId, lineUserId);
}

export async function getMenuForOrderingAction(menuId: string): Promise<Menu | null> {
  const menu = await getMenu(menuId);
  return menu ?? null;
}

export async function getExistingOrderAction(
  menuId: string,
  employeeId: string
): Promise<Order | null> {
  const order = await getOrder(menuId, employeeId);
  return order ?? null;
}

export async function submitOrderAction(
  menuId: string,
  employeeId: string,
  items: { menuItemId: string; quantity: number; customNotes?: string }[]
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  return upsertOrder(menuId, employeeId, items, "self");
}

export async function cancelOrderAction(menuId: string, employeeId: string): Promise<void> {
  await cancelOrder(menuId, employeeId);
}
