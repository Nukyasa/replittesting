import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { token, clearAuth, setAuth } = useAuthStore();
  
  const { data: user, isError, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!token || isError) {
      clearAuth();
      setLocation("/login");
    } else if (user && token) {
      setAuth(token, user);
    }
  }, [token, isError, user, setLocation, clearAuth, setAuth]);

  if (!token) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Skeleton className="w-12 h-12 rounded-full mx-auto" />
          <h2 className="text-lg font-medium text-gray-700">Učitavanje...</h2>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
