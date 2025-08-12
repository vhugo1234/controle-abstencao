import firebase_admin
from firebase_admin import credentials, db, initialize_app
import pandas as pd
from fpdf import FPDF
import os
import json
import glob
import re
import unicodedata
import xlsxwriter
import io

# Configuração do Firebase
cred_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if cred_json is None:
    cred_files = glob.glob("abstencao-d812a-firebase-adminsdk-*.json")
    if not cred_files:
        raise Exception("Arquivo de credencial do Firebase não encontrado!")
    cred_file = cred_files[0]
    with open(cred_file, "r") as f:
        cred_dict = json.load(f)
else:
    cred_dict = json.loads(cred_json)

cred = credentials.Certificate(cred_dict)
initialize_app(cred, {
    "databaseURL": "https://abstencao-d812a-default-rtdb.firebaseio.com/"
})

eventoFiltro = "Nome do Evento"
turnoFiltro = ""   # Exemplo: "Manhã"
escolaFiltro = ""  # Exemplo: "Escola Y"

def normalizar_evento(nome):
    return unicodedata.normalize('NFD', nome.strip().lower()) \
        .encode('ascii', 'ignore').decode('utf-8') \
        .replace(" ", "_")

# Normaliza o evento para bater com as chaves do Firebase
eventoFiltro = normalizar_evento(eventoFiltro) if eventoFiltro else ""

def ordenarSalasTurno(salas):
    def sala_num(sala):
        s = str(sala.get("sala", ""))
        match = re.search(r'\d+', s)
        return int(match.group()) if match else 0
    return sorted(salas, key=lambda sala: (sala_num(sala), sala.get("sala", "")))

def coletar_dados_firebase(eventoFiltro=""):
    ref = db.reference('relatorio_por_evento')
    dados_firebase = ref.get() or {}
    dados = []
    for evento_key, evento_data in dados_firebase.items():
        if eventoFiltro and evento_key != eventoFiltro:
            continue
        turnos = evento_data.get('turnos', {})
        for turno_key, turno_data in turnos.items():
            escolas = turno_data.get('escolas', {})
            for escola_key, escola_data in escolas.items():
                salas = escola_data.get('salas', {})
                # SUPORTE A LIST OU DICT:
                if isinstance(salas, dict):
                    sala_iter = salas.items()
                elif isinstance(salas, list):
                    sala_iter = enumerate(salas)
                else:
                    sala_iter = []
                for sala_key, sala_data in sala_iter:
                    dados.append({
                        "evento": sala_data.get("evento", evento_key),
                        "evento_key": evento_key,
                        "turno": sala_data.get("turno", turno_key),
                        "escola": sala_data.get("escola", escola_key),
                        "sala": sala_data.get("sala", sala_key),
                        "total": sala_data.get('total', 0),
                        "ausentes": sala_data.get('ausentes', 0),
                        "presentes": sala_data.get('presentes', 0),
                        "desistentes": sala_data.get('desistentes', 0),
                        "eliminados": sala_data.get('eliminados', 0),
                        "desistentesDetalhes": sala_data.get('desistentesDetalhes', []),
                        "eliminadosDetalhes": sala_data.get('eliminadosDetalhes', [])
                    })
    return dados



def exportar_relatorios(dados, eventoFiltro, turnoFiltro, escolaFiltro, formato_desejado): # <-- Adicionado 'formato_desejado'
    exportarSalas = [
        sala for sala in dados
        if (eventoFiltro == "" or sala.get("evento_key") == eventoFiltro)
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
        key = (sala["evento"], sala["escola"])
        escolas.setdefault(key, []).append(sala)
        totalGeral["total"] += int(sala.get("total", 0))
        totalGeral["ausentes"] += int(sala.get("ausentes", 0))
        totalGeral["presentes"] += int(sala.get("presentes", 0))
        totalGeral["desistentes"] += int(sala.get("desistentes", 0))
        totalGeral["eliminados"] += int(sala.get("eliminados", 0))

    for (evento_nome, escola_nome), salas in sorted(escolas.items(), key=lambda x: (str(x[0][0]), str(x[0][1]))):
        escTotal = escAusentes = escPresentes = escDesistentes = escEliminados = 0
        salasOrdenadas = ordenarSalasTurno(salas)
        print(f"Evento: {evento_nome} | Escola: {escola_nome} | Salas: {[s['sala'] for s in salasOrdenadas]}")
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
                    desist.get("motivo", "") or desist.get("descricao", ""),
                    1 if sala.get("eliminados", 0) > i else "",
                    elim.get("inscricao", ""),
                    elim.get("motivo", "") or elim.get("descricao", ""),
                    abstSala
                ])
            escTotal += int(sala.get("total", 0))
            escAusentes += int(sala.get("ausentes", 0))
            escPresentes += int(sala.get("presentes", 0))
            escDesistentes += int(sala.get("desistentes", 0))
            escEliminados += int(sala.get("eliminados", 0))

        percAbst = f"{((escAusentes / escTotal) * 100):.2f}".replace(".", ",") + "%" if escTotal else "0,00%"
        sheetData.append([
            f"TOTAL ESCOLA ({evento_nome})",
            "",
            escola_nome,
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

    if formato_desejado == 'xlsx':
        output = io.BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')

    # Exporta para Excel
    df = pd.DataFrame(sheetData)
    output_filename = "relatorio_abstencao.xlsx"
    
    # Cria um escritor de Excel usando o motor XlsxWriter
    writer = pd.ExcelWriter(output_filename, engine='xlsxwriter')
    
    # Escreve o DataFrame no arquivo, mas pulamos o cabeçalho para escrevê-lo manualmente
    df.to_excel(writer, sheet_name='Relatório de Abstenção', index=False, header=False)
    
    # Obtém os objetos workbook e worksheet do XlsxWriter para podermos formatá-los
    workbook = writer.book
    worksheet = writer.sheets['Relatório de Abstenção']
    
    # --- 1. DEFINIR OS ESTILOS DE CÉLULA ---
    
    # Estilo do Cabeçalho: Negrito, fundo cinza, borda e alinhamento central
    header_format = workbook.add_format({
        'bold': True,
        'fg_color': '#D3D3D3', # Cinza claro
        'border': 1,
        'align': 'center',
        'valign': 'vcenter'
    })
    
    # Estilo para as linhas de "TOTAL ESCOLA": Negrito, fundo azul claro e borda
    total_escola_format = workbook.add_format({
        'bold': True,
        'fg_color': '#DDEBF7', # Azul bem claro
        'border': 1
    })
    
    # Estilo para a linha de "TOTAL GERAL": Negrito, fundo amarelo claro e borda
    total_geral_format = workbook.add_format({
        'bold': True,
        'fg_color': '#FFF2CC', # Amarelo bem claro
        'border': 1
    })

    # Estilo para centralizar o conteúdo de algumas colunas
    center_format = workbook.add_format({'align': 'center'})

    # --- 2. APLICAR OS ESTILOS E AJUSTES ---
    
    # Escrever o cabeçalho manualmente usando o nosso estilo
    # (O DataFrame já foi escrito, então vamos sobrescrever a primeira linha)
    for col_num, value in enumerate(df.columns):
        worksheet.write(0, col_num, df.iloc[0, col_num], header_format)
    
    # Ajustar a largura das colunas para uma melhor visualização
    worksheet.set_column('A:A', 30)  # Evento
    worksheet.set_column('B:B', 15)  # Turno
    worksheet.set_column('C:C', 35)  # Escola
    worksheet.set_column('D:D', 10)  # Sala
    worksheet.set_column('E:H', 12, center_format) # Total, Ausentes, Presentes, etc. (centralizado)
    worksheet.set_column('I:J', 25)  # Detalhes Desistente
    worksheet.set_column('K:M', 25)  # Detalhes Eliminado
    worksheet.set_column('N:N', 15, center_format) # % Abstenção (centralizado)
    
    # Congelar o painel do cabeçalho para que ele fique sempre visível
    worksheet.freeze_panes(1, 0)

    # Aplicar os estilos de total nas linhas correspondentes
    for row_num, row_data in enumerate(df.values):
        # row_num + 1 porque a primeira linha (cabeçalho) é a linha 0
        if isinstance(row_data[0], str):
            if row_data[0].startswith("TOTAL ESCOLA"):
                worksheet.set_row(row_num, None, total_escola_format)
            elif row_data[0] == "TOTAL GERAL":
                worksheet.set_row(row_num, None, total_geral_format)
    
    # Salvar o arquivo Excel com todas as formatações
    writer.close()
    
    print("XLSX estilizado exportado com sucesso!")
    
    # --- FIM DA SEÇÃO DE EXPORTAÇÃO ESTILIZADA ---


    # Exporta para PDF (seu código original de PDF pode continuar aqui)
    class PDF(FPDF):
        # ... (código da classe PDF sem alterações) ...
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
dados = coletar_dados_firebase(eventoFiltro)
exportar_relatorios(dados, eventoFiltro, turnoFiltro, escolaFiltro)