import { Workspace } from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://nexusdesk-ai.vercel.app");

export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: "retail_ops",
    name: "E-Commerce & Retail",
    industry: "E-Commerce & Retail",
    icon: "ShoppingBag",
    description: "Product catalog search, pricing & discount rules, and 30-day return policy",
    seedPrompts: [
      "Find wireless noise-cancelling headphones under $100",
      "Can I return an item after 30 days if the box is open?",
      "Compare MacBook and Dell XPS laptop specs and deals"
    ],
    totalChunks: null,
    hasCatalog: true
  },
  {
    id: "clinic_ops",
    name: "Clinic & Patient Support",
    industry: "Clinic & Patient Support",
    icon: "Stethoscope",
    description: "Treatment FAQs, consultation fees, insurance coverage, and post-care instructions",
    seedPrompts: [
      "What should I do for post-operative care after a tooth extraction?",
      "What is the consultation fee for dental exams and do you accept insurance?",
      "What happens if I cancel my clinic appointment within 24 hours?"
    ],
    totalChunks: null,
    hasCatalog: false
  },
  {
    id: "hr_ops",
    name: "HR & Employee Operations",
    industry: "HR & Employee Operations",
    icon: "Users",
    description: "Annual leave accrual, remote work equipment reimbursement, parental leave, and policies",
    seedPrompts: [
      "How many days of annual leave do I get and does unused leave roll over?",
      "How do I submit an expense claim for my remote home office setup?",
      "What is the parental leave policy for primary and secondary caregivers?"
    ],
    totalChunks: null,
    hasCatalog: false
  }
];
