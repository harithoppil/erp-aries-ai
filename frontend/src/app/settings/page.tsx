"use client";

import { useState } from "react";
import { Building2, DollarSign, Receipt, Workflow, Bell, Shield } from "lucide-react";

const tabs = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "currency", label: "Currency", icon: DollarSign },
  { id: "tax", label: "Tax Templates", icon: Receipt },
  { id: "workflow", label: "Workflows", icon: Workflow },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("company");
  const [company, setCompany] = useState({ name: "Aries Marine LLC", tax_id: "TRN-1234567890123", vat_reg_no: "VAT-1002345678", currency: "AED", country: "AE", phone: "+971-2-555-0100", email: "info@ariesmarine.ae" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-gray-500">Configure your Aries Marine ERP instance</p>
      </div>
      <div className="flex gap-6">
        <div className="w-48 space-y-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === t.id ? "bg-gold/10 text-gold font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {activeTab === "company" && (
            <div className="space-y-4 max-w-lg">
              <h2 className="font-semibold text-navy">Company Information</h2>
              {Object.entries(company).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{key.replace(/_/g, " ")}</label>
                  <input value={value} onChange={(e) => setCompany({...company, [key]: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
                </div>
              ))}
              <button className="px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-[#B08D2F] transition-colors">Save Changes</button>
            </div>
          )}
          {activeTab !== "company" && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">{tabs.find(t => t.id === activeTab)?.label} settings coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
