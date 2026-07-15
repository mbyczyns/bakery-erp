import { Plus, Download } from "lucide-react";

export default function Faktury() {
    return (
        <div className="min-h-screen bg-ui-white text-ui-primary relative pb-10">

            {/* Nagłówek strony */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                {/* Lewa strona: Tytuł */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ui-black">
                        Faktury i Paragony
                    </h1>
                </div>

                {/* Prawa strona: Kontener na przyciski zgrupowane razem */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <button className="flex items-center justify-center gap-2 bg-ui-secondary/80 hover:bg-ui-secondary/70 text-ui-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto">
                        <Download size={18} />
                        Pobierz z KSeF
                    </button>

                    <button className="flex items-center justify-center gap-2 bg-ui-primary hover:bg-ui-primary/90 text-ui-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 text-sm w-full sm:w-auto">
                        <Plus size={18} />
                        Dodaj ręcznie
                    </button>
                </div>

            </div>
        </div>
    );
}