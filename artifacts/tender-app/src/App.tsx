import { Switch, Route } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthRoute } from "@/components/auth-route";

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import TendersPage from "@/pages/tenders";
import TenderDetailPage from "@/pages/tender-detail";
import AnalyticsPage from "@/pages/analytics";
import KanbanPage from "@/pages/kanban";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      <Route>
        <AuthRoute>
          <AppLayout>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/tenders" component={TendersPage} />
              <Route path="/tenders/:id" component={TenderDetailPage} />
              <Route path="/kanban" component={KanbanPage} />
              <Route path="/analytics" component={AnalyticsPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/admin" component={AdminPage} />
              <Route>
                <div className="p-8 text-center text-red-500">Stranica nije pronađena</div>
              </Route>
            </Switch>
          </AppLayout>
        </AuthRoute>
      </Route>
    </Switch>
  );
}
