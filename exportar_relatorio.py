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
                for sala_key, sala_data in salas.items():
                    dados.append({
                        "evento": sala_data.get("evento", evento_key),
                        "evento_key": evento_key,  # ✅ salva a chave real do Firebase
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



def exportar_relatorios(dados, eventoFiltro, turnoFiltro, escolaFiltro):
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

    header = sheetData[0]
    data_rows = sheetData[1:]
    
    # Criar um DataFrame apenas com as linhas de dados
    df = pd.DataFrame(data_rows)
    
    # Definir o nome do arquivo de saída
    output_filename = "relatorio_abstencao.xlsx"
    
    # Criar um escritor de Excel usando o motor XlsxWriter
    writer = pd.ExcelWriter(output_filename, engine='xlsxwriter')
    
    # Enviar o DataFrame para o Excel, começando da segunda linha (startrow=1)
    df.to_excel(writer, sheet_name='Relatório de Abstenção', index=False, header=False, startrow=1)
    
    # Obter os objetos workbook e worksheet
    workbook = writer.book
    worksheet = writer.sheets['Relatório de Abstenção']
    
    # --- 1. DEFINIR OS ESTILOS DE CÉLULA ---
    
    # Estilo do Cabeçalho: Negrito, fundo cinza, bordas e alinhamento
    header_format = workbook.add_format({
        'bold': True, 'fg_color': '#D3D3D3', 'border': 1,
        'align': 'center', 'valign': 'vcenter'
    })
    
    # NOVO: Estilo padrão para todas as células de dados, com borda
    default_format = workbook.add_format({'border': 1})
    
    # Estilo para as linhas de "TOTAL ESCOLA": Negrito, fundo azul, com borda
    total_escola_format = workbook.add_format({
        'bold': True, 'fg_color': '#DDEBF7', 'border': 1
    })
    
    # Estilo para a linha de "TOTAL GERAL": Negrito, fundo amarelo, com borda
    total_geral_format = workbook.add_format({
        'bold': True, 'fg_color': '#FFF2CC', 'border': 1
    })

    # Estilo para centralizar o conteúdo (agora também com borda)
    center_format = workbook.add_format({'align': 'center', 'border': 1})

    # --- 2. APLICAR OS ESTILOS E AJUSTES ---
    
    # Escrever o cabeçalho na primeira linha (linha 0) com seu estilo
    for col_num, value in enumerate(header):
        worksheet.write(0, col_num, value, header_format)
    
    # Ajustar a largura das colunas
    worksheet.set_column('A:A', 30); worksheet.set_column('B:B', 15); worksheet.set_column('C:C', 35)
    worksheet.set_column('D:D', 10); worksheet.set_column('E:H', 12)
    worksheet.set_column('I:J', 25); worksheet.set_column('K:M', 25); worksheet.set_column('N:N', 15)
    
    # Congelar o cabeçalho
    worksheet.freeze_panes(1, 0)

    # Aplicar os estilos de borda e total linha por linha
    for row_num in range(len(data_rows)):
        # O +1 é porque nossos dados começam na linha 1 da planilha
        linha_real_planilha = row_num + 1
        row_data = data_rows[row_num]
        
        # Define o formato base para a linha (com borda)
        formato_da_linha = default_format
        
        # Verifica se é uma linha de total para usar um formato especial
        if isinstance(row_data[0], str):
            if row_data[0].startswith("TOTAL ESCOLA"):
                formato_da_linha = total_escola_format
            elif row_data[0] == "TOTAL GERAL":
                formato_da_linha = total_geral_format

        # Aplica o formato à linha inteira
        worksheet.set_row(linha_real_planilha, 15, formato_da_linha)

        # Sobrescreve a formatação de células específicas para centralizar o conteúdo
        # Colunas E-H (índices 4-7) e N (índice 13)
        for col_idx in [4, 5, 6, 7, 13]:
            # Apenas para garantir, verificamos se a linha tem essa coluna
            if col_idx < len(row_data):
                cell_value = row_data[col_idx]
                worksheet.write(linha_real_planilha, col_idx, cell_value, center_format)

    # Salvar o arquivo Excel com todas as formatações
    writer.close()
    
    print("XLSX estilizado e com bordas exportado com sucesso!")
    
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