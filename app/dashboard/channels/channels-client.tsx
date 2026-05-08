"use client";

import { useState, useEffect, useMemo } from "react";
import {
  listConnectors,
  createConnector,
  updateConnector,
  deleteConnector,
  type ClientSafeConnector,
} from "@/app/dashboard/channels/actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Radio,
  Plus,
  Trash2,
  MessageCircle,
  Send,
  Hash,
  Globe,
  User,
  Wand2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useActionDispatcher, defineAction } from "@/store/useActionDispatcher";

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  telegram: Send,
  slack: Hash,
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-700 border-green-200",
  telegram: "bg-blue-100 text-blue-700 border-blue-200",
  slack: "bg-purple-100 text-purple-700 border-purple-200",
};

interface ChannelsClientProps {
  initialConnectors: ClientSafeConnector[];
}

export default function ChannelsClient({
  initialConnectors,
}: ChannelsClientProps) {
  const [connectors, setConnectors] =
    useState<ClientSafeConnector[]>(initialConnectors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel_type: "whatsapp",
    webhook_url: "",
    default_persona_id: "",
  });

  // Register AI UI actions for this page
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    registerActions(
      [
        defineAction({
          name: "create_connector",
          description: "Open and fill the create connector form with the provided details. Opens dialog and fills all fields in one shot.",
          parameters: {
            type: "object",
            required: ["name", "channel_type"],
            properties: {
              name: { type: "string", description: "Connector name (required)" },
              channel_type: { type: "string", description: "Channel type (required)", enum: ["whatsapp", "telegram", "slack"] },
              webhook_url: { type: "string", description: "Webhook URL" },
              default_persona_id: { type: "string", description: "Default AI persona ID" },
            },
          },
        }),
      ],
      {
        create_connector: (args: Record<string, any>) => {
          setDialogOpen(true);
          setForm((prev) => ({
            ...prev,
            name: args.name || prev.name,
            channel_type: args.channel_type || prev.channel_type,
            webhook_url: args.webhook_url || prev.webhook_url,
            default_persona_id: args.default_persona_id || prev.default_persona_id,
          }));
          toast.info("AI opened and filled the connector form", { icon: <Wand2 size={14} /> });
        },
      }
    );
    return () => unregisterActions();
  }, [registerActions, unregisterActions]);

  // AI page context
  const contextSummary =
    connectors.length > 0
      ? `Channel Connectors page: ${connectors.length} connectors. Types: ${[...new Set(connectors.map((c) => c.channel_type))].join(", ")}. Enabled: ${connectors.filter((c) => c.enabled).length}, Disabled: ${connectors.filter((c) => !c.enabled).length}.`
      : "Channel Connectors page: No connectors configured.";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const res = await listConnectors();
      if (res.success) setConnectors(res.connectors);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createConnector({
      name: form.name,
      channel_type: form.channel_type,
      webhook_url: form.webhook_url || undefined,
      default_persona_id: form.default_persona_id || undefined,
    });
    if (result.success) {
      toast.success("Connector created");
      setDialogOpen(false);
      setForm({
        name: "",
        channel_type: "whatsapp",
        webhook_url: "",
        default_persona_id: "",
      });
      load();
    } else {
      toast.error(result.error || "Failed to create connector");
    }
    setSaving(false);
  };

  const handleToggle = async (connector: ClientSafeConnector) => {
    const result = await updateConnector(connector.id, {
      enabled: !connector.enabled,
    });
    if (result.success) {
      toast.success(
        connector.enabled ? "Connector disabled" : "Connector enabled"
      );
      load();
    } else {
      toast.error(result.error || "Failed to update connector");
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteConnector(id);
    if (result.success) {
      toast.success("Connector deleted");
      load();
    } else {
      toast.error(result.error || "Failed to delete connector");
    }
  };

  const enabledCount = useMemo(
    () => connectors.filter((c) => c.enabled).length,
    [connectors]
  );
  const disabledCount = useMemo(
    () => connectors.filter((c) => !c.enabled).length,
    [connectors]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">
                Channel Connectors
              </h2>
              <p className="text-sm text-[#64748b] mt-1">
                {connectors.length} connectors &middot; {enabledCount} enabled
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"
            >
              <Plus size={16} /> Add Connector
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Radio size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Total
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {connectors.length}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={16} className="text-green-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Enabled
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {enabledCount}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={16} className="text-gray-400" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Disabled
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {disabledCount}
              </p>
            </div>
          </div>

          {/* Connector Cards */}
          {connectors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
              <Radio size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">No connectors configured</p>
              <p className="text-sm">
                Add a channel connector to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectors.map((connector) => {
                const ChannelIcon =
                  CHANNEL_ICONS[connector.channel_type] || Radio;
                const channelColor =
                  CHANNEL_COLORS[connector.channel_type] ||
                  "bg-gray-100 text-gray-700 border-gray-200";

                return (
                  <div
                    key={connector.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative"
                  >
                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(connector.id)}
                      className="absolute top-3 right-3 h-8 w-8 p-0 text-[#94a3b8] hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </Button>

                    {/* Channel type badge */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${channelColor.split(" ").slice(0, 1).join(" ")}`}
                      >
                        <ChannelIcon size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0f172a]">
                          {connector.name}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${channelColor}`}
                        >
                          {connector.channel_type}
                        </span>
                      </div>
                    </div>

                    {/* Webhook URL */}
                    <div className="mb-3">
                      <span className="text-xs font-medium text-[#64748b] uppercase">
                        Webhook URL
                      </span>
                      <p className="text-sm text-[#0f172a] mt-0.5 break-all">
                        {connector.webhook_url || "—"}
                      </p>
                    </div>

                    {/* Default Persona */}
                    <div className="mb-4">
                      <span className="text-xs font-medium text-[#64748b] uppercase">
                        Default Persona
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <User size={12} className="text-[#94a3b8]" />
                        <p className="text-sm text-[#64748b]">
                          {connector.default_persona_id
                            ? connector.default_persona_id.slice(0, 8) + "..."
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span
                        className={`text-sm font-medium ${connector.enabled ? "text-green-600" : "text-[#94a3b8]"}`}
                      >
                        {connector.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Switch
                        checked={connector.enabled}
                        onCheckedChange={() => handleToggle(connector)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Connector Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Channel Connector</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                Connector Name <span className="text-red-500">*</span>
              </label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Customer Support WhatsApp"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Channel Type <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={form.channel_type}
                onChange={(e) =>
                  setForm({ ...form, channel_type: e.target.value })
                }
                required
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="slack">Slack</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Webhook URL</label>
              <Input
                value={form.webhook_url}
                onChange={(e) =>
                  setForm({ ...form, webhook_url: e.target.value })
                }
                placeholder="https://example.com/webhook"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Default Persona ID</label>
              <Input
                value={form.default_persona_id}
                onChange={(e) =>
                  setForm({ ...form, default_persona_id: e.target.value })
                }
                placeholder="Optional persona UUID"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                {saving ? "Creating..." : "Add Connector"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
