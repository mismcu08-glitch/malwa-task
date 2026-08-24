import {
  User,
  TaskItem,
  StageAssignmentConfig,
  InventoryItem,
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    User_ID: 'USR-001',
    Full_Name: 'Amit Meena',
    Email: 'amit.meena@malwaconcrete.com',
    Password: 'admin',
    Role: 'Admin',
    Department: 'Executive Systems',
    Phone_Number: '+91 98260 11001',
    Status: 'Active',
    Allowed_Modules: [1, 2, 3, 4, 5, 6],
    Avatar_Color: 'bg-blue-600',
  },
];

export const INITIAL_TASKS: TaskItem[] = [];

export const INITIAL_STAGE_ASSIGNMENTS: StageAssignmentConfig = {
  purchaseSteps: [
    {
      stepNumber: 1,
      stepName: 'Indent Requisition & Material Need',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 4,
      description: 'Factory floor foreman raises raw material shortage requirement',
    },
    {
      stepNumber: 2,
      stepName: 'Vendor Quotation Comparison',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 6,
      description: 'Procurement team collects 3 verified supplier rates',
    },
    {
      stepNumber: 3,
      stepName: 'Executive Commercial Approval',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 12,
      description: 'Plant Director / Admin signs off on rate & payment terms',
    },
    {
      stepNumber: 4,
      stepName: 'Purchase Order Issuance (PO)',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 4,
      description: 'Formal digital PO generated and transmitted to vendor',
    },
    {
      stepNumber: 5,
      stepName: 'Security Gate Inward & Weight Check',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 2,
      description: 'Dharamkanta weighment slip & physical gate pass verified',
    },
    {
      stepNumber: 6,
      stepName: 'Store GRN & Stock Increment',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 3,
      description: 'Goods Receipt Note verified & bin stock ledger updated',
    },
  ],
  dispatchStages: [
    {
      stageNumber: 1,
      stageTitle: 'Loading Instruction Release',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 2,
    },
    {
      stageNumber: 2,
      stageTitle: 'Truck Arrival & Spotting',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 2,
    },
    {
      stageNumber: 3,
      stageTitle: 'Overhead Gantry Loading',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 3,
    },
    {
      stageNumber: 4,
      stageTitle: 'Weighbridge & Gate Outward',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 1,
    },
    {
      stageNumber: 5,
      stageTitle: 'Customer Site POD Call & Sign-off',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      defaultSlaHours: 24,
    },
  ],
  fmsSteps: [
    {
      stepNumber: 1,
      stepTitle: 'Indent Requisition Received',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      assignedName: 'Amit Meena',
      defaultSlaHours: 2,
      autoNotifyWhatsApp: true,
    },
    {
      stepNumber: 2,
      stepTitle: 'Transporter Assigned & Vehicle Spotting',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      assignedName: 'Amit Meena',
      defaultSlaHours: 3,
      autoNotifyWhatsApp: true,
    },
    {
      stepNumber: 3,
      stepTitle: 'Physical Loading & Quality Inspection',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      assignedName: 'Amit Meena',
      defaultSlaHours: 2,
      autoNotifyWhatsApp: true,
    },
    {
      stepNumber: 4,
      stepTitle: 'Invoice, E-Way Bill & Gate Clearance',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      assignedName: 'Amit Meena',
      defaultSlaHours: 1,
      autoNotifyWhatsApp: true,
    },
    {
      stepNumber: 5,
      stepTitle: 'En-Route GPS Tracking & In-Transit',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      assignedName: 'Amit Meena',
      defaultSlaHours: 12,
      autoNotifyWhatsApp: true,
    },
    {
      stepNumber: 6,
      stepTitle: 'Consignee Delivery POD Confirmation',
      assignedEmail: 'amit.meena@malwaconcrete.com',
      assignedName: 'Amit Meena',
      defaultSlaHours: 4,
      autoNotifyWhatsApp: true,
    },
  ],
  qcApprovers: [
    { testType: 'Compressive Strength (7/28 Days)', assignedEmail: 'amit.meena@malwaconcrete.com', assignedName: 'Amit Meena', leadTimeHours: 24 },
    { testType: 'Three-Edge Bearing Hydrostatic Test', assignedEmail: 'amit.meena@malwaconcrete.com', assignedName: 'Amit Meena', leadTimeHours: 8 },
    { testType: 'Rubber Gasket Elasticity & Ring Fit', assignedEmail: 'amit.meena@malwaconcrete.com', assignedName: 'Amit Meena', leadTimeHours: 4 },
  ],
  applicationApprovers: [
    { department: 'Executive Systems', approverEmail: 'amit.meena@malwaconcrete.com', approverName: 'Amit Meena' },
  ],
  slaWatchdogConfig: {
    criticalBreachHours: 4,
    autoGenerateEscalationTicket: true,
    escalateToEmail: 'amit.meena@malwaconcrete.com',
    notifyOnWhatsAppGroup: true,
  },
};

export const INITIAL_INVENTORY: InventoryItem[] = [];
