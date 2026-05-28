import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, ShieldAlert, MoreHorizontal } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function AdminPage() {
  const { data: users, isLoading } = useListUsers();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" /> Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">Upravljanje korisnicima i pravima pristupa</p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" /> Dodaj korisnika
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Korisnici sistema</CardTitle>
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
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={
                          u.role === "admin" ? "bg-red-50 text-red-700 border-red-200" :
                          u.role === "user" ? "bg-blue-50 text-primary border-blue-200" : ""
                        }>
                          {u.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600">{u.department || "-"}</td>
                      <td className="p-3 text-gray-600">{formatDate(u.createdAt)}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
