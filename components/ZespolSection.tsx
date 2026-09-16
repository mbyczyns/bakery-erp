"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Users,
    UserPlus,
    Briefcase,
    Microwave,
    Search,
    Edit3,
    Trash2,
    X,
    AlertCircle,
    Eye,
    EyeOff,
    Loader2,
    Calendar,
    CheckCircle2,
    Sparkles
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type UserRole = "MANAGER" | "BAKER";

interface TeamMember {
    id: string;
    name: string | null;
    login: string;
    role: UserRole;
    createdAt: string;
}

// Funkcja automatycznego generowania loginu z imienia i nazwiska (np. Jan Kowalski -> j.kowalski)
export function generateLoginFromName(fullName: string): string {
    if (!fullName) return "";

    const polishMap: Record<string, string> = {
        ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
        Ą: "a", Ć: "c", Ę: "e", Ł: "l", Ń: "n", Ó: "o", Ś: "s", Ź: "z", Ż: "z",
    };

    const normalized = fullName
        .split("")
        .map((c) => polishMap[c] || c)
        .join("")
        .toLowerCase()
        .trim();

    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) {
        return parts[0].replace(/[^a-z0-9]/g, "");
    }

    const firstLetter = parts[0].replace(/[^a-z0-9]/g, "")[0] || "";
    // Ostatni człon jako nazwisko, lub połączenie członów
    const lastName = parts[parts.length - 1].replace(/[^a-z0-9]/g, "");

    if (!lastName) return firstLetter;
    return `${firstLetter}.${lastName}`;
}

// Helper formatowania daty: DD.MM.YYYY
function formatDate(dateStr?: string | null): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

export default function ZespolSection() {
    const { user: currentUser } = useAuth();

    const [users, setUsers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Powiadomienia (Toast)
    const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Modal: Dodawanie użytkownika
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        name: "",
        login: "",
        password: "",
        role: "BAKER" as UserRole,
    });
    const [isLoginManuallyEdited, setIsLoginManuallyEdited] = useState(false);
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

    // Modal: Edycja użytkownika
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
    const [editForm, setEditForm] = useState({
        name: "",
        role: "BAKER" as UserRole,
    });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    // Modal: Usuwanie użytkownika
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<TeamMember | null>(null);
    const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

    // Pobieranie listy pracowników
    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/users");
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Błąd pobierania listy użytkowników");
            }
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            showNotification("error", err.message || "Nie udało się pobrać listy użytkowników");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const showNotification = (type: "success" | "error", message: string) => {
        setNotification({ type, message });
        setTimeout(() => {
            setNotification((prev) => (prev?.message === message ? null : prev));
        }, 5000);
    };

    // Filtrowanie i wyszukiwarka
    const filteredUsers = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        return users.filter((u) => {
            if (!query) return true;
            return (
                (u.name && u.name.toLowerCase().includes(query)) ||
                u.login.toLowerCase().includes(query)
            );
        });
    }, [users, searchTerm]);

    // Konfiguracja ról (Manager & Piekarz)
    const getRoleDetails = (role: UserRole) => {
        switch (role) {
            case "MANAGER":
                return {
                    label: "Manager",
                    badge: "bg-blue-50 text-ui-primary border-ui-accent",
                    avatarBg: "bg-blue-100 text-ui-primary border-ui-accent",
                    icon: Briefcase,
                    description: "Dostęp do finansów, faktur, kontrahentów, produkcji, receptur i konfiguracji.",
                };
            case "BAKER":
                return {
                    label: "Pracownik",
                    badge: "bg-blue-50 text-ui-primary border-ui-accent",
                    avatarBg: "bg-blue-100 text-ui-primary border-ui-accent",
                    icon: Microwave,
                    description: "Dostęp do sekcji produkcyjnych: Produkcja i sprzedaż, Składniki, Przepisy.",
                };
        }
    };

    // Otwarcie modalu dodawania
    const handleOpenAddModal = () => {
        setAddForm({
            name: "",
            login: "",
            password: "",
            role: "BAKER",
        });
        setIsLoginManuallyEdited(false);
        setShowAddPassword(false);
        setIsAddModalOpen(true);
    };

    // Obsługa zmiany Imienia i Nazwiska z automatycznym generowaniem loginu
    const handleNameChange = (newName: string) => {
        const autoLogin = isLoginManuallyEdited ? addForm.login : generateLoginFromName(newName);
        setAddForm((prev) => ({
            ...prev,
            name: newName,
            login: isLoginManuallyEdited ? prev.login : autoLogin,
        }));
    };

    // Zapis nowego użytkownika
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.login || !addForm.password) {
            showNotification("error", "Login i hasło są wymagane");
            return;
        }

        try {
            setIsSubmittingAdd(true);
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(addForm),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Błąd podczas dodawania użytkownika");
            }

            showNotification("success", `Użytkownik "${data.login}" został pomyślnie utworzony.`);
            setIsAddModalOpen(false);
            fetchUsers();
        } catch (err: any) {
            showNotification("error", err.message || "Wystąpił błąd");
        } finally {
            setIsSubmittingAdd(false);
        }
    };

    // Otwarcie modalu edycji
    const handleOpenEditModal = (user: TeamMember) => {
        setEditingUser(user);
        setEditForm({
            name: user.name || "",
            role: user.role,
        });
        setIsEditModalOpen(true);
    };

    // Zapis edycji użytkownika (nazwa + rola)
    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            setIsSubmittingEdit(true);
            const payload = {
                name: editForm.name,
                role: editForm.role,
            };

            const res = await fetch(`/api/users/${editingUser.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Błąd podczas edycji użytkownika");
            }

            showNotification("success", `Dane użytkownika "${editingUser.login}" zostały zaktualizowane.`);
            setIsEditModalOpen(false);
            fetchUsers();
        } catch (err: any) {
            showNotification("error", err.message || "Wystąpił błąd");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Otwarcie modalu usuwania
    const handleOpenDeleteModal = (user: TeamMember) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    // Potwierdzenie usunięcia
    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            setIsSubmittingDelete(true);
            const res = await fetch(`/api/users/${userToDelete.id}`, {
                method: "DELETE",
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Błąd podczas usuwania użytkownika");
            }

            showNotification("success", `Użytkownik "${userToDelete.login}" został usunięty.`);
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
            fetchUsers();
        } catch (err: any) {
            showNotification("error", err.message || "Wystąpił błąd");
        } finally {
            setIsSubmittingDelete(false);
        }
    };

    return (
        <div className="bg-ui-white rounded-2xl p-6 shadow-sm border border-ui-accent hover:border-ui-secondary transition-all duration-300">
            {/* Powiadomienie Toast */}
            {notification && (
                <div
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border transition-all ${notification.type === "success"
                        ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                        : "bg-rose-50 text-rose-900 border-rose-300"
                        }`}
                >
                    {notification.type === "success" ? (
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle size={18} className="text-rose-600 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{notification.message}</span>
                    <button
                        onClick={() => setNotification(null)}
                        className="ml-2 text-ui-primary/50 hover:text-ui-primary"
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* Nagłówek sekcji */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 border-b border-ui-accent/30 pb-3 sm:pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-ui-accent/20 p-2 sm:p-2.5 rounded-xl text-ui-primary shrink-0">
                        <Users size={20} className="text-ui-secondary" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-ui-black">Pracownicy</h2>
                    </div>
                </div>

                <button
                    onClick={handleOpenAddModal}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 border border-ui-accent bg-ui-white hover:bg-ui-accent/20 text-ui-primary px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm cursor-pointer"
                >
                    <UserPlus size={16} />
                    <span>Dodaj pracownika</span>
                </button>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-ui-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Wyszukaj pracownika po nazwisku lub loginie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-ui-white pl-12 pr-4 py-3 rounded-xl border border-ui-accent text-ui-primary shadow-sm focus:outline-none focus:border-ui-secondary transition-all text-sm"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-4 top-3.5 text-ui-secondary hover:text-ui-primary"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Tabela pracowników */}
            <div className="bg-ui-white border border-ui-accent rounded-xl overflow-hidden shadow-xs">
                {isLoading ? (
                    <div className="p-12 text-center text-ui-secondary flex items-center justify-center gap-2">
                        <Loader2 size={20} className="animate-spin text-ui-secondary" />
                        <span>Pobieranie listy użytkowników...</span>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-10 text-center text-ui-secondary italic">
                        Nie znaleziono pracowników spełniających kryteria.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse table-auto">
                            <thead>
                                <tr className="bg-ui-accent/10 text-ui-secondary text-xs font-bold uppercase tracking-wider border-b border-ui-accent">
                                    <th className="p-4">Pracownik</th>
                                    <th className="p-4">Login</th>
                                    <th className="p-4">Rola</th>
                                    <th className="p-4 text-right">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ui-accent/40 text-sm">
                                {filteredUsers.map((member) => {
                                    const roleDetails = getRoleDetails(member.role);
                                    const RoleIcon = roleDetails.icon;
                                    const isSelf = currentUser?.id === member.id;

                                    return (
                                        <tr
                                            key={member.id}
                                            className="hover:bg-ui-accent/5 transition-colors group"
                                        >
                                            {/* Pracownik */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-ui-black">
                                                                {member.name || member.login}
                                                            </span>
                                                            {isSelf && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    Ty
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Login */}
                                            <td className="p-4 font-mono text-xs text-ui-primary font-semibold">
                                                {member.login}
                                            </td>

                                            {/* Rola */}
                                            <td className="p-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${roleDetails.badge}`}
                                                >
                                                    <RoleIcon size={13} />
                                                    {roleDetails.label}
                                                </span>
                                            </td>

                                            {/* Akcje */}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditModal(member)}
                                                        className="p-2 text-ui-primary/60 hover:text-ui-primary hover:bg-ui-accent/20 rounded-lg transition-colors cursor-pointer"
                                                        title="Edytuj dane lub zmień rolę"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenDeleteModal(member)}
                                                        disabled={isSelf}
                                                        className={`p-2 rounded-lg transition-colors ${isSelf
                                                            ? "text-ui-primary/20 cursor-not-allowed"
                                                            : "text-ui-primary/60 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                                            }`}
                                                        title={
                                                            isSelf
                                                                ? "Nie możesz usunąć swojego konta"
                                                                : "Usuń pracownika"
                                                        }
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL: Dodaj pracownika */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ui-black/50 backdrop-blur-xs animate-fade-in">
                    <div className="bg-ui-white border border-ui-accent rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-ui-accent">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-ui-accent/20 text-ui-secondary">
                                    <UserPlus size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-ui-black">Dodaj nowego pracownika</h3>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 text-ui-secondary hover:text-ui-primary rounded-lg hover:bg-ui-accent/20 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-5 space-y-4">
                            {/* Imię i nazwisko */}
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                    Imię i nazwisko *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={addForm.name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="np. Jan Kowalski"
                                    className="w-full px-3.5 py-2.5 bg-ui-white border border-ui-accent rounded-xl text-sm text-ui-primary placeholder:text-ui-secondary/50 focus:outline-none focus:border-ui-secondary"
                                />
                            </div>

                            {/* Login (Automatycznie generowany) */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                        Login (Nazwa użytkownika) *
                                    </label>

                                </div>
                                <input
                                    type="text"
                                    required
                                    value={addForm.login}
                                    onChange={(e) => {
                                        setIsLoginManuallyEdited(true);
                                        setAddForm({ ...addForm, login: e.target.value });
                                    }}
                                    placeholder="np. j.kowalski"
                                    className="w-full px-3.5 py-2.5 bg-ui-white border border-ui-accent rounded-xl text-sm text-ui-primary font-mono placeholder:text-ui-secondary/50 focus:outline-none focus:border-ui-secondary"
                                />
                            </div>

                            {/* Hasło */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-ui-secondary uppercase tracking-wider">
                                        Hasło początkowe *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const randomPass = "Haslo!" + Math.floor(100 + Math.random() * 900);
                                            setAddForm({ ...addForm, password: randomPass });
                                            setShowAddPassword(true);
                                        }}
                                        className="text-[11px] font-bold text-ui-secondary hover:underline cursor-pointer"
                                    >
                                        Wygeneruj hasło
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showAddPassword ? "text" : "password"}
                                        required
                                        value={addForm.password}
                                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                                        placeholder="Min. 4 znaki"
                                        className="w-full pl-3.5 pr-10 py-2.5 bg-ui-white border border-ui-accent rounded-xl text-sm text-ui-primary placeholder:text-ui-secondary/50 focus:outline-none focus:border-ui-secondary"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPassword(!showAddPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-secondary hover:text-ui-primary"
                                    >
                                        {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Wybór roli: MANAGER lub BAKER */}
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-2">
                                    Rola w systemie *
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(["BAKER", "MANAGER"] as UserRole[]).map((r) => {
                                        const isSelected = addForm.role === r;
                                        const details = getRoleDetails(r);
                                        const Icon = details.icon;

                                        return (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setAddForm({ ...addForm, role: r })}
                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                                                    ? `${details.badge} ring-2 ring-ui-secondary`
                                                    : "bg-ui-white border-ui-accent text-ui-primary/70 hover:bg-ui-accent/10"
                                                    }`}
                                            >
                                                <Icon size={18} className="mb-1.5" />
                                                <div className="font-bold text-xs">{details.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-ui-primary/60">
                                    {getRoleDetails(addForm.role).description}
                                </p>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-ui-accent">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-ui-primary/70 hover:bg-ui-accent/20 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAdd}
                                    className="px-5 py-2.5 bg-ui-primary text-ui-white rounded-xl font-semibold hover:bg-ui-primary/90 transition-all text-sm cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmittingAdd ? "Tworzenie..." : "Utwórz konto"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Edycja pracownika */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ui-black/50 backdrop-blur-xs animate-fade-in">
                    <div className="bg-ui-white border border-ui-accent rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-ui-accent">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-ui-accent/20 text-ui-secondary">
                                    <Edit3 size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-ui-black">
                                    Edycja: @{editingUser.login}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1.5 text-ui-secondary hover:text-ui-primary rounded-lg hover:bg-ui-accent/20 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-5 space-y-4">
                            {/* Imię i nazwisko */}
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-1.5">
                                    Imię i nazwisko
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    placeholder="np. Jan Kowalski"
                                    className="w-full px-3.5 py-2.5 bg-ui-white border border-ui-accent rounded-xl text-sm text-ui-primary placeholder:text-ui-secondary/50 focus:outline-none focus:border-ui-secondary"
                                />
                            </div>

                            {/* Rola: MANAGER lub BAKER */}
                            <div>
                                <label className="block text-xs font-bold text-ui-secondary uppercase tracking-wider mb-2">
                                    Rola w systemie
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(["BAKER", "MANAGER"] as UserRole[]).map((r) => {
                                        const isSelected = editForm.role === r;
                                        const details = getRoleDetails(r);
                                        const Icon = details.icon;

                                        return (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setEditForm({ ...editForm, role: r })}
                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                                                    ? `${details.badge} ring-2 ring-ui-secondary`
                                                    : "bg-ui-white border-ui-accent text-ui-primary/70 hover:bg-ui-accent/10"
                                                    }`}
                                            >
                                                <Icon size={18} className="mb-1.5" />
                                                <div className="font-bold text-xs">{details.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-ui-primary/60">
                                    {getRoleDetails(editForm.role).description}
                                </p>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-ui-accent">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-ui-primary/70 hover:bg-ui-accent/20 transition-colors cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingEdit}
                                    className="px-5 py-2.5 bg-ui-primary text-ui-white rounded-xl font-semibold hover:bg-ui-primary/90 transition-all text-sm cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmittingEdit ? "Zapisywanie..." : "Zapisz zmiany"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Usuwanie pracownika */}
            {isDeleteModalOpen && userToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ui-black/50 backdrop-blur-xs animate-fade-in">
                    <div className="bg-ui-white border border-rose-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-ui-black">
                                Usunąć użytkownika?
                            </h3>
                            <p className="text-xs text-ui-primary/70 leading-relaxed">
                                Czy na pewno chcesz bezpowrotnie usunąć konto użytkownika{" "}
                                <strong className="text-ui-black font-bold">
                                    {userToDelete.name || userToDelete.login} (@{userToDelete.login})
                                </strong>
                                ? Użytkownik straci natychmiast dostęp do aplikacji.
                            </p>
                        </div>

                        <div className="p-4 bg-ui-accent/10 border-t border-ui-accent flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-ui-primary/70 hover:bg-ui-accent/20 transition-colors cursor-pointer"
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteUser}
                                disabled={isSubmittingDelete}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm transition-all text-sm cursor-pointer disabled:opacity-50"
                            >
                                {isSubmittingDelete ? "Usuwanie..." : "Usuń konto"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
