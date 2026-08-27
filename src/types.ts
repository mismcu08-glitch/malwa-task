export type Role =
  | 'Admin'
  | 'Manager'
  | 'Executive'
  | 'Production_Operator'
  | 'Storekeeper'
  | 'Driver'
  | 'Auditor'
  | 'Security';

export type Department =
  | 'Executive Systems'
  | 'Purchase & Ops'
  | 'Procurement & Stores'
  | 'Logistics & Dispatch'
  | 'Factory Ops'
  | 'Inventory & Store'
  | 'Fleet'
  | 'Quality & Compliance'
  | 'Security & Gate';

export interface SystemModule {
  id: number;
  name: string;
  key: string;
  description?: string;
}

export const SYSTEM_MODULES: SystemModule[] = [
  { id: 1, name: 'Task & Routine Hub', key: 'TASK_HUB', description: 'Assigned tasks, checklists & daily SOP execution' },
  { id: 2, name: 'Delegate Task', key: 'DELEGATE_TASK', description: 'Create, assign & dispatch operations to employees' },
  { id: 3, name: 'Delayed Tasks & MIS', key: 'DELAYED_TASKS', description: 'Overdue task tracker, bottleneck flags & escalations' },
  { id: 4, name: 'Upcoming & Frequency Forecast', key: 'UPCOMING_FORECAST', description: 'Future task projections, recurrence horizon & date toggles' },
  { id: 5, name: 'Operational Analytics', key: 'ANALYTICS', description: 'Department KPIs, completion rate & operational metrics' },
  { id: 6, name: 'Google Sheets DB Sync', key: 'SHEETS_SYNC', description: 'Live spreadsheet streaming & transaction audit logs' },
  { id: 7, name: 'Admin & Granular RBAC', key: 'ADMIN', description: 'User permissions, role access & system configuration' },
];

export interface User {
  User_ID: string;
  Full_Name: string;
  Email: string;
  Password?: string;
  Role: Role;
  Department: Department;
  Phone_Number: string;
  Status: 'Active' | 'Inactive';
  Allowed_Modules?: number[];
  Avatar_Color?: string;
}

export type TaskFrequency = 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export type TaskPriority = 'High' | 'Medium' | 'Low';

export type TaskStatus = 'Pending' | 'In_Progress' | 'Completed' | 'Overdue';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface TaskComment {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface TaskItem {
  Task_ID: string;
  Task_Name: string;
  Description?: string;
  Assigned_To?: string;
  Assigned_To_Email: string;
  Assigned_To_Name?: string;
  Assigned_By_Email: string;
  Assigned_By_Name?: string;
  Frequency: TaskFrequency;
  Due_Date: string; // YYYY-MM-DD
  Due_Time?: string; // HH:mm
  Priority: TaskPriority;
  Status: TaskStatus;
  Progress_Percentage: number;
  Subtasks: SubtaskItem[];
  Comments?: TaskComment[];
  Created_At: string;
  Completed_At?: string;
  Turnaround_Hours?: number;
  Notes?: string;
  Department?: Department;
  Tags?: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'ASSIGNMENT' | 'DEADLINE_REMINDER' | 'COMPLETION' | 'OVERDUE_ALERT' | 'UPDATE';
  taskId?: string;
  targetEmail: string;
  createdAt: string;
  read: boolean;
}

export interface StageStep {
  stepNumber?: number;
  stageNumber?: number;
  stepName?: string;
  stepTitle?: string;
  stageTitle?: string;
  assignedEmail: string;
  assignedName?: string;
  defaultSlaHours: number;
  description?: string;
  autoNotifyWhatsApp?: boolean;
}

export interface StageAssignmentConfig {
  purchaseSteps: StageStep[];
  dispatchStages: StageStep[];
  fmsSteps?: StageStep[];
  qcApprovers?: { testType: string; assignedEmail: string; assignedName: string; leadTimeHours: number }[];
  applicationApprovers?: { department: Department; approverEmail: string; approverName: string }[];
  slaWatchdogConfig?: {
    criticalBreachHours: number;
    autoGenerateEscalationTicket: boolean;
    escalateToEmail: string;
    notifyOnWhatsAppGroup: boolean;
  };
}

export interface InventoryItem {
  SKU: string;
  Name: string;
  Category: string;
  CurrentStock: number;
  Unit: string;
  MinThreshold: number;
}

export interface TruckGateEntry {
  Entry_ID: string;
  Truck_Number: string;
  Driver_Name: string;
  Purpose: 'RAW_MATERIAL_IN' | 'FINISHED_DISPATCH' | 'EMPTY_RETURN';
  In_Time: string;
  Out_Time?: string;
  Status: 'INSIDE_FACTORY' | 'GATE_OUT';
}

export interface PurchaseIndent {
  Indent_ID: string;
  Material_Name: string;
  Quantity: number;
  Unit: string;
  Current_Step: number;
  Current_Assignee_Email: string;
  Overall_Status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  Steps: {
    Step_Number: number;
    Step_Name: string;
    Status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    Assigned_To_Email: string;
    Assigned_To_Name?: string;
    SLA_Target_Hours: number;
  }[];
  Steps_Timeline: { Step_Number: number; Assignee: string; Completed_At?: string }[];
}

export interface DispatchItem {
  Dispatch_ID: string;
  Order_ID: string;
  Destination: string;
  Truck_Number: string;
  Quantity_Pcs: number;
  Status: string;
}

export interface DispatchOrder {
  Order_ID: string;
  Customer: string;
  Product: string;
  Quantity: number;
  Status: string;
}

export interface DeliveryConsignment {
  Consignment_ID: string;
  Truck_Number: string;
  Overall_Status: 'In_Transit' | 'Completed' | 'Cancelled';
  Stage1_Loading_Instruction?: { Assignee: string; Status: string };
  Stage2_Truck_Arrival?: { Assignee: string; Status: string };
  Stage3_Truck_Loaded?: { Assignee: string; Status: string };
  Stage4_Truck_Dispatched?: { Assignee: string; Status: string };
  Stage5_Delivery_Confirmed?: { Assignee: string; Status: string };
}

export interface ApplicationItem {
  Application_ID: string;
  Type: string;
  Department: Department;
  Status: 'PENDING' | 'APPROVED' | 'REJECTED';
  Assigned_Approver_Email: string;
  Applicant_Name: string;
}

export interface TicketItem {
  Ticket_ID: string;
  Subject: string;
  Priority: 'High' | 'Medium' | 'Low';
  Assigned_To: string;
  Status: 'OPEN' | 'RESOLVED';
}

export interface StockTransaction {
  Transaction_ID: string;
  SKU: string;
  Type: 'IN' | 'OUT';
  Quantity: number;
  Timestamp: string;
}

export interface OnlinePresenceUser {
  email: string;
  fullName: string;
  role: Role;
  department: Department;
  lastActive: string;
  currentView?: string;
}
