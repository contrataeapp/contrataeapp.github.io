# Orientações para Migração do Banco de Dados e Próximos Passos

## 1. Scripts SQL para o Novo Schema

Conforme solicitado, os scripts SQL para a criação do novo schema foram gerados de forma modular para facilitar a execução e evitar conflitos. Eles estão localizados na pasta `sql_scripts` no repositório clonado:

- `/home/ubuntu/contrataeapp/sql_scripts/01_create_enums.sql`: Criação dos tipos `ENUM` personalizados.
- `/home/ubuntu/contrataeapp/sql_scripts/02_create_tables.sql`: Criação das tabelas principais com suas chaves primárias.
- `/home/ubuntu/contrataeapp/sql_scripts/03_create_fks.sql`: Definição das chaves estrangeiras para garantir a integridade referencial.
- `/home/ubuntu/contrataeapp/sql_scripts/04_create_indexes.sql`: Criação de índices para otimização de consultas.

**Instruções de Execução no Supabase:**

1.  **Acesse o Supabase Studio:** Navegue até o projeto desejado (preferencialmente o novo projeto na conta `time.contratae`).
2.  **Vá para a seção SQL Editor:** No menu lateral, clique em "SQL Editor".
3.  **Execute os scripts em ordem:** Copie e cole o conteúdo de cada arquivo `.sql` no editor, executando-os um por um, na ordem numérica (01, 02, 03, 04). Isso garante que as dependências (ENUMs antes das tabelas, tabelas antes das FKs, etc.) sejam respeitadas.

## 2. Migração para a Conta `time.contratae` no Supabase

**Recomendação:** É **altamente recomendável** criar o novo banco de dados diretamente na conta `time.contratae` do Supabase. Isso oferece as seguintes vantagens:

-   **Evita Migração de Dados:** Se você criar o novo schema em um projeto já existente na conta `time.contratae`, poderá planejar a migração dos dados antigos para o novo schema dentro do mesmo ambiente, sem a necessidade de exportar/importar entre diferentes projetos ou contas.
-   **Gerenciamento Centralizado:** Facilita o gerenciamento de permissões, backups e configurações de segurança para toda a equipe.
-   **Consistência:** Garante que todos os ambientes (desenvolvimento, staging, produção) possam ser configurados de forma consistente sob a mesma organização.

**Passos para a Migração (se o banco atual estiver em outra conta/projeto):**

1.  **Crie um Novo Projeto (ou use um existente) na conta `time.contratae`:** Se ainda não tiver um projeto adequado, crie um novo no Supabase sob a organização `time.contratae`.
2.  **Execute os Scripts SQL:** Conforme as instruções acima, crie o novo schema neste projeto.
3.  **Migração de Dados (Manual ou Scripted):** Esta é a parte mais complexa. Você precisará exportar os dados das tabelas antigas (do banco de dados original) e importá-los para as novas tabelas no novo schema. Isso pode ser feito via:
    -   **Exportação/Importação CSV:** Para tabelas menores, você pode exportar os dados para CSV e importá-los via Supabase Studio.
    -   **Scripts de Migração:** Para dados mais complexos ou grandes volumes, é melhor escrever scripts SQL ou Node.js que leiam os dados do banco antigo e os insiram no novo schema, mapeando as colunas corretamente. **Este passo é crítico e deve ser planejado com cuidado para evitar perda de dados.**

## 3. Próximos Passos no Código (Refatoração do Backend)

Após a criação do novo schema e a migração dos dados, o código do backend precisará ser atualizado para refletir as mudanças.

1.  **Atualizar Variáveis de Ambiente:** Certifique-se de que `process.env.SUPABASE_URL` e `process.env.SUPABASE_KEY` no seu arquivo `.env` apontem para o novo projeto Supabase.
2.  **Atualizar Queries do Supabase:** Todas as chamadas `supabase.from(
