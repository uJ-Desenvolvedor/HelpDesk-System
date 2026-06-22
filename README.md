# 🎫 Corporate Helpdesk & Ticket Management System

Um sistema corporativo completo de Helpdesk e gerenciamento de chamados desenvolvido com tecnologias web nativas. O foco principal deste projeto foi construir uma aplicação robusta, com regras de negócio complexas, controle de estado e segurança no front-end, sem a dependência de frameworks ou bibliotecas externas.

---

## 🚀 Funcionalidades Principais

- **Autenticação Dinâmica Baseada em Perfis (Roles):** A interface se transforma dinamicamente com base no nível de acesso do usuário logado:
  - **Usuário Comum:** Consegue abrir novos chamados (com preenchimento automatizado de perfil).
  - **Suporte Técnico:** Possui acesso exclusivo a um painel de gerenciamento avançado, podendo alterar o status do ticket em tempo real ou excluir chamados.
- **Fluxo de Atualização Interativa:** Ao alterar o status de um chamado para "Em Andamento" ou "Concluído", o sistema exige uma justificativa técnica que é gravada com carimbo de data, hora e nome do técnico responsável.
- **Mecanismo de Conversação Interna (Chat):** Permite a troca de comentários e mensagens em tempo real entre o usuário e o técnico de suporte dentro de cada chamado, com um contador visual na listagem principal.
- **Dashboard de Métricas:** Painel reativo com indicadores quantitativos automatizados para chamados Abertos, Em Andamento e Concluídos.
- **Filtros Avançados:** Filtro dinâmico na tabela de chamados para segmentação instantânea do fluxo de trabalho.

---

## 🛠️ Desafios Técnicos e Decisões de Engenharia

### 1. Arquitetura de Estado Centralizada (Single Source of Truth)
A aplicação adota o conceito de fonte única da verdade através de um objeto global `state`. Toda e qualquer alteração de dados atualiza o estado primeiro, disparando a renderização controlada e limpa da interface (UI). Esse padrão simula o comportamento interno de bibliotecas modernas como React e Redux.

### 2. Segurança de Dados (Mitigação de Vulnerabilidades XSS)
Para impedir ataques de injeção de scripts maliciosos (*Cross-Site Scripting*), implementei um algoritmo de sanitização e escape de caracteres nativo (`escapeHtml`). Ele neutraliza tags e strings inseridas nos inputs pelos usuários antes de injetá-las via manipulação de DOM na tabela.

### 3. Persistência de Dados e Ciclo de Vida
Uso estratégico das APIs de armazenamento do navegador (*Web Storage API*):
- **`localStorage`:** Utilizado para persistência a longo prazo dos dados e histórico de chamados.
- **`sessionStorage`:** Utilizado para gerenciar a volatilidade da sessão de autenticação do usuário, limpando o acesso por segurança assim que a aba é encerrada.

### 4. Robustez de Código e IDs Universais
O projeto adota uma abordagem de desenvolvimento defensivo com o uso extensivo de *Optional Chaining* (`?.`) para blindar o DOM contra erros de execução em tempo de execução. Para a identificação dos tickets, o sistema prioriza o uso da API nativa `crypto.randomUUID()`, reduzindo a zero o risco de colisão de chaves.

---

## 💻 Tecnologias Utilizadas

- **HTML5 Semântico**
- **CSS3 Moderno** (Arquitetura CSS baseada em Design Tokens e padronização de classes com metodologia BEM)
- **Vanilla JavaScript** (ES6+)

---

## 🔧 Como Executar o Projeto Localmente

1. Faça o clone deste repositório:
   ```bash
   git clone [https://github.com/uJ-Desenvolvedor/HelpDesk-System.git](https://github.com/uJ-Desenvolvedor/HelpDesk-System.git)
