# Teste v11.3.42 — navegação pública

Teste primeiro em Android real ou simulador com largura semelhante ao celular.

## 1. Índice anônimo
- Abrir `/` sem login.
- Confirmar barra inferior: `Início | Busca | Menu | Entrar`.
- `Menu` deve abrir o menu público e fechar no X.
- `Busca` deve ir para a busca rápida do índice.
- Verificar tema Claro/Escuro.

## 2. Instalação Android
- Abrir o índice fora do PWA instalado.
- O convite deve aparecer rapidamente com `Instalar agora` e `Instalar depois`.
- `Instalar agora`: quando o Android/Chrome liberar o evento PWA, deve abrir o prompt nativo.
- `Instalar depois`: convite fecha e não deve reaparecer em toda navegação.
- Não deve aparecer `Ver como instalar` no Android.

## 3. Cabeçalho logado como profissional
- Abrir índice/categoria logado como profissional.
- O bloco `Francisco ▼` deve mostrar só o botão fechado inicialmente.
- Tocar em `Francisco` ou na seta: deve abrir `Perfil | Área Profissional | Sair`.
- Tocar novamente ou fora: fecha.
- `Modo Profissional Ativo` deve ficar abaixo do cabeçalho.

## 4. Outras Categorias
- Abrir `/categoria/outros`.
- A barra inferior deve ser o mesmo padrão do índice: `Início | Busca | Menu | Entrar/Painel`.
- Não deve voltar ao antigo `Início | Explorar | Perfil`.

## 5. Categorias
Testar Pintores, Pedreiros, Eletricistas, Encanadores e uma categoria dinâmica.
- Mesma barra inferior.
- `Menu` funcional.
- Se logado, quarto item = `Painel`.
- Faixa de modo profissional consistente.

## 6. Login (`/auth/login`)
Sem ter iniciado cadastro:
- `Início` precisa funcionar.
- `Voltar` precisa funcionar; sem histórico útil, deve voltar ao início.
- `Menu` precisa abrir uma folha com categorias/Contato/Instalar/Criar conta.
- `Entrar` permanece destacado.
- `Voltar para a plataforma` continua funcionando.

## 7. Cadastro/onboarding
- Avançar para escolha de tipo/cadastro.
- Confirmar que as regras de proteção do fluxo continuam iguais.
- `Voltar` deve continuar retornando etapa quando previsto.
- Saída que interrompe cadastro deve continuar pedindo confirmação.
- Navegações perceptíveis devem mostrar feedback de carregamento.

## 8. Tema público
- Alternar Claro/Escuro no índice, Outros, Contato e categorias.
- Verificar se cards não ficam presos visualmente no tema escuro.

## 9. Regressão rápida da Área Profissional
- Abrir Área Profissional.
- Navegar Visão/Serviços/Profissões/Portfólio/Mais.
- Não é necessário retestar todo o motor nesta versão, mas confirmar que o acesso público → Painel continua normal.
