import firebase_admin
from firebase_admin import credentials, db
import pandas as pd
from fpdf import FPDF
import os
import json

# Configuração do Firebase
cred_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if cred_json is None:
    raise Exception("Variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não encontrada!")

cred_dict = json.loads(cred_json)
cred = credentials.Certificate(cred_dict)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://abstencao-d812a-default-rtdb.firebaseio.com/'
})

# Filtros (altere conforme desejado)
eventoFiltro = ""  # Exemplo: "Evento X"
turnoFiltro = ""   # Exemplo: "Manhã"
escolaFiltro = ""  # Exemplo: "Escola Y"

def ordenarSalasTurno(salas):
    # Ordena por sala (modifique se quiser outra ordenação)
    return sorted(salas, key=lambda x: x.get("sala", ""))

def coletar_dados_firebase():
    # Altere a referência conforme seu BD
    ref = db.reference('relatorio_por_evento')
    dados_firebase = ref.get() or {}

    # Transforma o Firebase em dados de sala
    dados = []
    for evento, evento_data in dados_firebase.items():
        turnos = evento_data.get('turnos', {})
        for turno, turno_data in turnos.items():
            escolas = turno_data.get('escolas', {})
            for escola, escola_data in escolas.items():
                salas = escola_data.get('salas', {})
                for sala_nome, sala_data in salas.items():
                    dados.append({
                        "evento": evento,
                        "turno": turno,
                        "escola": escola,
                        "sala": sala_nome,
                        "total": sala_data.get('total', 0),
                        "ausentes": sala_data.get('ausentes', 0),
                        "presentes": sala_data.get('presentes', 0),
                        "desistentes": sala_data.get('desistentes', 0),
                        "eliminados": sala_data.get('eliminados', 0),
                        "desistentesDetalhes": sala_data.get('desistentesDetalhes', []),
                        "eliminadosDetalhes": sala_data.get('eliminadosDetalhes', [])
                    })
    return dados

def exportar_relatorios(dados, eventoFiltro, turnoFiltro, escolaFiltro):
    # Filtra as salas conforme os filtros
    exportarSalas = [
        sala for sala in dados
        if (eventoFiltro == "" or sala.get("evento") == eventoFiltro)
        and (turnoFiltro == "" or sala.get("turno") == turnoFiltro)
        and (escolaFiltro == "" or sala.get("escola") == escolaFiltro)
    ]

    sheetData = [
        ["Evento", "Turno", "Escola", "Sala", "Total", "Ausentes", "Presentes",
         "Desistentes", "Inscrição_Desistente", "Motivo_Desistente",
         "Eliminados", "Inscrição_Eliminado", "Motivo_Eliminado", "% Abstenção"]
    ]

    escolas = {}
    totalGeral = dict(total=0, ausentes=0, presentes=0, desistentes=0, eliminados=0)
    for sala in exportarSalas:
        escolas.setdefault(sala["escola"], []).append(sala)
        totalGeral["total"] += int(sala.get("total", 0))
        totalGeral["ausentes"] += int(sala.get("ausentes", 0))
        totalGeral["presentes"] += int(sala.get("presentes", 0))
        totalGeral["desistentes"] += int(sala.get("desistentes", 0))
        totalGeral["eliminados"] += int(sala.get("eliminados", 0))

    # Agrupa por escola e insere totais conforme modelo JS
    for escolaNome, salas in escolas.items():
        escTotal = escAusentes = escPresentes = escDesistentes = escEliminados = 0
        salasOrdenadas = ordenarSalasTurno(salas)
        for sala in salasOrdenadas:
            maxCount = max(
                len(sala.get("desistentesDetalhes", []) or []),
                len(sala.get("eliminadosDetalhes", []) or []),
                1
            )
            for i in range(maxCount):
                desist = (sala.get("desistentesDetalhes") or [{}])[i] if i < len(sala.get("desistentesDetalhes", [])) else {}
                elim = (sala.get("eliminadosDetalhes") or [{}])[i] if i < len(sala.get("eliminadosDetalhes", [])) else {}
                abstSala = (
                    f"{((sala.get('ausentes', 0) / sala.get('total', 1)) * 100):.2f}".replace(".", ",") + "%" 
                    if sala.get("total", 0) else "0,00%"
                )
                sheetData.append([
                    sala.get("evento"),
                    sala.get("turno"),
                    sala.get("escola"),
                    sala.get("sala"),
                    sala.get("total"),
                    sala.get("ausentes"),
                    sala.get("presentes"),
                    1 if sala.get("desistentes", 0) > i else "",
                    desist.get("inscricao", ""),
                    desist.get("motivo", ""),
                    1 if sala.get("eliminados", 0) > i else "",
                    elim.get("inscricao", ""),
                    elim.get("motivo", ""),
                    abstSala
                ])
            escTotal += int(sala.get("total", 0))
            escAusentes += int(sala.get("ausentes", 0))
            escPresentes += int(sala.get("presentes", 0))
            escDesistentes += int(sala.get("desistentes", 0))
            escEliminados += int(sala.get("eliminados", 0))

        percAbst = f"{((escAusentes / escTotal) * 100):.2f}".replace(".", ",") + "%" if escTotal else "0,00%"
        sheetData.append([
            "TOTAL ESCOLA",
            "",
            escolaNome,
            "",
            escTotal,
            escAusentes,
            escPresentes,
            escDesistentes,
            "",
            "",
            escEliminados,
            "",
            "",
            percAbst
        ])
        sheetData.append([])  # linha em branco

    percGeral = f"{((totalGeral['ausentes'] / totalGeral['total']) * 100):.2f}".replace(".", ",") + "%" if totalGeral["total"] else "0,00%"
    sheetData.append([
        "TOTAL GERAL",
        "",
        "",
        "",
        totalGeral["total"],
        totalGeral["ausentes"],
        totalGeral["presentes"],
        totalGeral["desistentes"],
        "",
        "",
        totalGeral["eliminados"],
        "",
        "",
        percGeral
    ])

    # Exporta para Excel
    df = pd.DataFrame(sheetData)
    df.to_excel("relatorio_abstencao.xlsx", header=False, index=False)
    print("XLSX exportado com sucesso!")

    # Exporta para PDF
    class PDF(FPDF):
        def header(self):
            self.set_font("Helvetica", "B", 12)
            self.cell(0, 10, "Relatório de Abstenção", border=0, ln=1, align="C")
            self.ln(5)
        def footer(self):
            self.set_y(-15)
            self.set_font("Helvetica", "I", 8)
            self.cell(0, 10, f"Página {self.page_no()}", 0, 0, "C")
        def tabela(self, table):
            self.set_font("Helvetica", "B", 7)
            col_widths = [22, 18, 30, 12, 12, 16, 16, 20, 30, 30, 20, 30, 30, 20]
            for i, header in enumerate(table[0]):
                self.cell(col_widths[i], 8, str(header), border=1, align="C")
            self.ln()
            self.set_font("Helvetica", "", 7)
            for row in table[1:]:
                for i, item in enumerate(row):
                    self.cell(col_widths[i], 8, str(item), border=1, align="C")
                self.ln()

    pdf = PDF(orientation="L", unit="mm", format="A4")
    pdf.add_page()
    pdf.tabela(sheetData)
    pdf.output("relatorio_abstencao.pdf")
    print("PDF exportado com sucesso!")

# Execução
dados = coletar_dados_firebase()
exportar_relatorios(dados, eventoFiltro, turnoFiltro, escolaFiltro)