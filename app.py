from flask import Flask, send_file, request, jsonify
import exportar_relatorio  # Importe seu script Python (ajuste se o nome for diferente)
import os

app = Flask(__name__)

@app.route('/exportar_relatorio', methods=['GET'])
def exportar_relatorio_endpoint():
    evento = request.args.get('evento', '')
    turno = request.args.get('turno', '')
    escola = request.args.get('escola', '')
    formato = request.args.get('formato', 'xlsx')  # 'xlsx' ou 'pdf'

    # Busca e exporta usando sua função
    dados = exportar_relatorio.coletar_dados_firebase()
    exportar_relatorio.exportar_relatorios(dados, evento, turno, escola)

    # Envia o arquivo gerado
    arquivo = 'relatorio_abstencao.xlsx' if formato == 'xlsx' else 'relatorio_abstencao.pdf'
    if not os.path.exists(arquivo):
        return jsonify({'error': 'Arquivo não gerado'}), 500

    return send_file(arquivo, as_attachment=True)

if __name__ == '__main__':
    # Rode em modo de produção para múltiplos usuários (ex: Gunicorn)
    app.run(host='0.0.0.0', port=5000)