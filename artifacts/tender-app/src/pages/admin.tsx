import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, ShieldAlert, Edit2, Trash2, X, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();

  // Mutations
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  // Modal Dialog States
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  // Security Access Guard
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 bg-white rounded-xl border p-8 shadow-sm">
        <ShieldAlert className="w-16 h-16 text-red-600 animate-pulse" />
        <h2 className="text-xl font-bold text-gray-900">Pristup odbijen</h2>
        <p className="text-gray-500 text-sm max-w-md text-center">
          Samo administratori sistema imaju pristup ovoj stranici. Molimo vas da se obratite administratoru ukoliko smatrate da je ovo greška.
        </p>
      </div>
    );
  }

  const openCreateDialog = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("user");
    setDepartment("");
    setIsOpen(true);
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setName(user.name || "");
    setEmail(user.email || "");
    setPassword(""); // Never pre-populate passwords
    setRole(user.role || "user");
    setDepartment(user.department || "");
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || (!editingUser && !password)) {
      toast.error("Molimo vas da popunite sva obavezna polja.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        // Edit Mode
        await updateUserMutation.mutateAsync({
          id: editingUser.id,
          data: {
            name,
            role,
            department: department || undefined,
          },
        });
        toast.success(`Korisnik ${name} je uspješno ažuriran.`);
      } else {
        // Create Mode
        await createUserMutation.mutateAsync({
          data: {
            name,
            email,
            password,
            role,
            department: department || undefined,
          },
        });
        toast.success(`Korisnik ${name} je uspješno kreiran.`);
      }
      queryClient.invalidateQueries({ queryKey: ["listUsers"] });
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Došlo je do greške prilikom spremanja korisnika.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      await deleteUserMutation.mutateAsync({ id: deletingUser.id });
      toast.success(`Korisnik ${deletingUser.name} je uklonjen iz sistema.`);
      queryClient.invalidateQueries({ queryKey: ["listUsers"] });
      setDeletingUser(null);
    } catch (err: any) {
      toast.error(err.message || "Greška prilikom brisanja korisnika.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#002d82]" /> Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">Upravljanje korisnicima i pravima pristupa</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/95 text-white shadow-sm flex items-center gap-2 cursor-pointer">
          <UserPlus className="w-4 h-4" /> Dodaj korisnika
        </Button>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Korisnici sistema</CardTitle>
          <CardDescription>Lista svih korisnika koji imaju pristup ASA Tender Intelligence platformi</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50 text-gray-500 font-medium">
                    <th className="p-3">Korisnik</th>
                    <th className="p-3">Uloga</th>
                    <th className="p-3">Odjel</th>
                    <th className="p-3">Datum registracije</th>
                    <th className="p-3 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <Badge className={
                          u.role === "admin" 
                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" 
                            : "bg-[#002d82]/10 text-primary border-transparent hover:bg-[#002d82]/10"
                        }>
                          {u.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600 font-medium">{u.department || "-"}</td>
                      <td className="p-3 text-gray-500">{formatDate(u.createdAt)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg cursor-pointer"
                            onClick={() => openEditDialog(u)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            onClick={() => setDeletingUser(u)}
                            disabled={u.id === currentUser?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT DIALOG */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="bg-primary px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-base">
                {editingUser ? "Uredi korisnika" : "Dodaj novog korisnika"}
              </h3>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-blue-200 hover:text-white transition-colors p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ime i Prezime *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="npr. Almir Zeljković"
                  className="w-full text-sm p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Adresa *</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@asacentral.ba"
                  className="w-full text-sm p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:text-gray-400"
                  required
                  disabled={!!editingUser}
                />
              </div>

              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lozinka *</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 karaktera"
                    className="w-full text-sm p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required={!editingUser}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Uloga *</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full text-sm p-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Odjel</label>
                  <input 
                    type="text" 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="npr. Prodaja"
                    className="w-full text-sm p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg cursor-pointer"
                >
                  Otkaži
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/95 text-white rounded-lg cursor-pointer"
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Spremanje...</>
                  ) : (
                    "Spremi"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-gray-100">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-gray-900 text-base">Ukloni korisnika?</h4>
                <p className="text-sm text-gray-500">
                  Da li ste sigurni da želite obrisati korisnika <strong>{deletingUser.name}</strong> ({deletingUser.email})? Ova akcija se ne može poništiti.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setDeletingUser(null)} 
                  className="flex-1 rounded-lg cursor-pointer"
                >
                  Otkaži
                </Button>
                <Button 
                  onClick={handleDeleteConfirm} 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
                  disabled={deleteUserMutation.isPending}
                >
                  {deleteUserMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Uklanjanje...</>
                  ) : (
                    "Ukloni"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
