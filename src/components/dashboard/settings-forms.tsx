"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface AlertChannel {
  id: string;
  channelId: string;
  channelName: string;
  alertType: string | null;
}

interface ServiceRepo {
  id: string;
  serviceName: string;
  repoFullName: string;
  pathsFilter: string | null;
}

interface SettingsFormsProps {
  alertChannels: AlertChannel[];
  serviceRepos: ServiceRepo[];
}

export function SettingsForms({ alertChannels, serviceRepos }: SettingsFormsProps) {
  const router = useRouter();

  // ── Alert Channels ────────────────────────────────────────────────────────
  const [newChannel, setNewChannel] = useState({ channelId: "", channelName: "", alertType: "" });
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelDraft, setEditChannelDraft] = useState<AlertChannel | null>(null);

  const addAlertChannel = async () => {
    if (!newChannel.channelId || !newChannel.channelName) return;
    await fetch("/api/settings/alert-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newChannel),
    });
    setNewChannel({ channelId: "", channelName: "", alertType: "" });
    router.refresh();
  };

  const startEditChannel = (ch: AlertChannel) => {
    setEditingChannelId(ch.id);
    setEditChannelDraft({ ...ch });
  };

  const cancelEditChannel = () => {
    setEditingChannelId(null);
    setEditChannelDraft(null);
  };

  const saveEditChannel = async () => {
    if (!editChannelDraft) return;
    await fetch(`/api/settings/alert-channels?id=${editChannelDraft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editChannelDraft),
    });
    cancelEditChannel();
    router.refresh();
  };

  const deleteAlertChannel = async (id: string) => {
    await fetch(`/api/settings/alert-channels?id=${id}`, { method: "DELETE" });
    router.refresh();
  };

  // ── Service Repos ─────────────────────────────────────────────────────────
  const [newRepo, setNewRepo] = useState({ serviceName: "", repoFullName: "", pathsFilter: "" });
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
  const [editRepoDraft, setEditRepoDraft] = useState<ServiceRepo | null>(null);

  const addServiceRepo = async () => {
    if (!newRepo.serviceName || !newRepo.repoFullName) return;
    await fetch("/api/settings/service-repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRepo),
    });
    setNewRepo({ serviceName: "", repoFullName: "", pathsFilter: "" });
    router.refresh();
  };

  const startEditRepo = (r: ServiceRepo) => {
    setEditingRepoId(r.id);
    setEditRepoDraft({ ...r });
  };

  const cancelEditRepo = () => {
    setEditingRepoId(null);
    setEditRepoDraft(null);
  };

  const saveEditRepo = async () => {
    if (!editRepoDraft) return;
    await fetch(`/api/settings/service-repos?id=${editRepoDraft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editRepoDraft),
    });
    cancelEditRepo();
    router.refresh();
  };

  const deleteServiceRepo = async (id: string) => {
    await fetch(`/api/settings/service-repos?id=${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <>
      {/* ── Alert Channels ── */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Alert Type</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertChannels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                    No alert channels configured yet.
                  </TableCell>
                </TableRow>
              )}
              {alertChannels.map((ch) =>
                editingChannelId === ch.id && editChannelDraft ? (
                  <TableRow key={ch.id} className="bg-muted/40">
                    <TableCell>
                      <Input
                        value={editChannelDraft.channelId}
                        onChange={(e) => setEditChannelDraft({ ...editChannelDraft, channelId: e.target.value })}
                        className="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editChannelDraft.channelName}
                        onChange={(e) => setEditChannelDraft({ ...editChannelDraft, channelName: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editChannelDraft.alertType ?? ""}
                        onChange={(e) => setEditChannelDraft({ ...editChannelDraft, alertType: e.target.value || null })}
                        className="h-7 text-xs"
                        placeholder="all"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={saveEditChannel} className="h-7 w-7 text-green-600 hover:text-green-700">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEditChannel} className="h-7 w-7 text-muted-foreground">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={ch.id}>
                    <TableCell className="font-mono text-xs">{ch.channelId}</TableCell>
                    <TableCell>#{ch.channelName}</TableCell>
                    <TableCell>{ch.alertType ?? "all"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditChannel(ch)}
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAlertChannel(ch.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>

          {/* Add new row */}
          <div className="flex gap-2 items-end pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Channel ID</Label>
              <Input
                placeholder="C0123ABC"
                value={newChannel.channelId}
                onChange={(e) => setNewChannel({ ...newChannel, channelId: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel Name</Label>
              <Input
                placeholder="alerts"
                value={newChannel.channelName}
                onChange={(e) => setNewChannel({ ...newChannel, channelName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alert Type</Label>
              <Input
                placeholder="all"
                value={newChannel.alertType}
                onChange={(e) => setNewChannel({ ...newChannel, alertType: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={addAlertChannel} className="h-8">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Service-to-Repo Mapping ── */}
      <Card>
        <CardHeader>
          <CardTitle>Service-to-Repo Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Name</TableHead>
                <TableHead>GitHub Repo</TableHead>
                <TableHead>Paths Filter</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceRepos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                    No service-repo mappings configured yet.
                  </TableCell>
                </TableRow>
              )}
              {serviceRepos.map((r) =>
                editingRepoId === r.id && editRepoDraft ? (
                  <TableRow key={r.id} className="bg-muted/40">
                    <TableCell>
                      <Input
                        value={editRepoDraft.serviceName}
                        onChange={(e) => setEditRepoDraft({ ...editRepoDraft, serviceName: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editRepoDraft.repoFullName}
                        onChange={(e) => setEditRepoDraft({ ...editRepoDraft, repoFullName: e.target.value })}
                        className="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editRepoDraft.pathsFilter ?? ""}
                        onChange={(e) => setEditRepoDraft({ ...editRepoDraft, pathsFilter: e.target.value || null })}
                        className="h-7 text-xs"
                        placeholder="*"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={saveEditRepo} className="h-7 w-7 text-green-600 hover:text-green-700">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEditRepo} className="h-7 w-7 text-muted-foreground">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={r.id}>
                    <TableCell>{r.serviceName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.repoFullName}</TableCell>
                    <TableCell className="text-xs">{r.pathsFilter ?? "*"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditRepo(r)}
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteServiceRepo(r.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>

          {/* Add new row */}
          <div className="flex gap-2 items-end pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Service Name</Label>
              <Input
                placeholder="payment-service"
                value={newRepo.serviceName}
                onChange={(e) => setNewRepo({ ...newRepo, serviceName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Repo (owner/name)</Label>
              <Input
                placeholder="farajiansamin/payment-service"
                value={newRepo.repoFullName}
                onChange={(e) => setNewRepo({ ...newRepo, repoFullName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Paths Filter</Label>
              <Input
                placeholder="terraform/**"
                value={newRepo.pathsFilter}
                onChange={(e) => setNewRepo({ ...newRepo, pathsFilter: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={addServiceRepo} className="h-8">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
