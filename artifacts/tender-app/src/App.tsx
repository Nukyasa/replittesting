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
import CalendarPage from "@/pages/calendar";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import CompanyPage from "@/pages/company";
import MarketsPage from "@/pages/markets";
import AuthoritiesPage from "@/pages/authorities";
import AuthorityDetailPage from "@/pages/authority-detail";
import SuppliersPage from "@/pages/suppliers";
import SupplierDetailPage from "@/pages/supplier-detail";
import TenderProjectsPage from "@/pages/tender-projects";
import ResolutionsPage from "@/pages/resolutions";
import EarlyWarningPage from "@/pages/early-warning";
import WatchlistsPage from "@/pages/watchlists";
import CompanyCheckPage from "@/pages/company-check";
import HistoryPage from "@/pages/history";
import RenewalRadarPage from "@/pages/renewal-radar";

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
              <Route path="/renewal-radar" component={RenewalRadarPage} />
              <Route path="/history" component={HistoryPage} />
              <Route path="/tenders/:id" component={TenderDetailPage} />
              <Route path="/tender-projects" component={TenderProjectsPage} />
              <Route path="/resolutions" component={ResolutionsPage} />
              <Route path="/early-warning" component={EarlyWarningPage} />
              <Route path="/watchlists" component={WatchlistsPage} />
              <Route path="/kanban" component={KanbanPage} />
              <Route path="/calendar" component={CalendarPage} />
              <Route path="/analytics" component={AnalyticsPage} />
              <Route path="/company" component={CompanyPage} />
              <Route path="/provjera-firme" component={CompanyCheckPage} />
              <Route path="/company-check" component={CompanyCheckPage} />
              <Route path="/markets" component={MarketsPage} />
              <Route path="/authorities" component={AuthoritiesPage} />
              <Route path="/authorities/:id" component={AuthorityDetailPage} />
              <Route path="/suppliers" component={SuppliersPage} />
              <Route path="/suppliers/:id" component={SupplierDetailPage} />
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

