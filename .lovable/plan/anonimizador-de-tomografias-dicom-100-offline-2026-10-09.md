# Anonimizador de Tomografias (DICOM) — 100% offline

## Objetivo

Web app que recebe um ZIP (ou pasta/arquivos) de tomografia em DICOM, remove dados pessoais de todos os arquivos e gera um novo ZIP para download. Todo o processamento acontece no navegador do usuário: nenhum arquivo sai do computador.

## Experiência do usuário

1. **Tela inicial** com título claro, selo "Funciona offline · Nada é enviado" e botão "Ver código-fonte no GitHub".
2. **Área de arrastar e soltar** para ZIP, arquivos .dcm ou pasta inteira.
3. **Pré-visualização**: quantidade de arquivos, quantos são DICOM, e tabela "antes → depois" mostrando os valores reais dos campos sensíveis encontrados (nome, data de nascimento, ID, instituição etc.), agrupados por paciente/estudo quando houver mais de um. Por padrão oculto como um campo de senha e cokmum ícone de olho para revelar 
4. **Novo nome do paciente**: campo editável, com valor padrão "ANONIMIZADO" (também aplicado ao ID do paciente, ex.: "ANONIMIZADO"). O valor escolhido aparece na coluna "depois" em tempo real.
5. **Opções** (com explicação simples de cada uma):
  - Manter datas do exame (padrão: deslocar/remover)
  - Manter sexo e idade aproximada (padrão: manter)
  - Remover tags privadas de fabricantes (padrão: sim)
6. **Botão "Anonimizar e baixar ZIP"** com barra de progresso; ZIP final contém os arquivos limpos + um relatório `RELATORIO_ANONIMIZACAO.txt` listando exatamente o que foi alterado.
7. **Seção "Como funciona"**: lista completa das tags removidas/substituídas, explicação de que tudo roda localmente, e aviso honesto de limitação: dados "queimados" na imagem (texto nos pixels) não são removidos.
8. **Indicador de conexão**: mostra que o app continua funcionando sem internet.

## Visual

Interface limpa e sóbria, tons claros com verde-azulado clínico como cor de destaque, tipografia legível (não genérica), ícones de cadeado/escudo discretos, textos em português.

## Regras de anonimização

Baseadas no perfil básico de confidencialidade do padrão DICOM (PS3.15 Anexo E): nome, ID e nascimento do paciente, endereço, telefones, médicos, instituição, números de acesso, descrições livres, tags privadas. UIDs são regenerados de forma consistente (mesmo estudo continua agrupado). PatientIdentityRemoved = YES.

## Detalhes técnicos

- Processamento 100% no cliente: leitura/edição DICOM com `dcmjs`, ZIP com `fflate` (sem servidor, sem Lovable Cloud).
- Processamento em Web Worker para não travar a tela com tomografias grandes.
- Offline: service worker com cache de todos os arquivos do app (PWA instalável).
- Sem analytics, sem fontes ou scripts externos (fontes empacotadas localmente) — reforça o "nada sai do computador".
- Pronto para GitHub Pages: build estático (prerender da página única) e caminhos relativos.
- Link do GitHub configurável em um único lugar (placeholder até você informar a URL do repositório).