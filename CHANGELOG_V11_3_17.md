# Contrataê v11.3.17 — perfil público e cards corrigidos

Base: v11.3.16.

## Correções

1. Rota pública `/perfil/:id`
   - Corrigido erro interno causado pelo render usando variável incorreta.
   - Removido embed frágil de `categories` dentro da consulta principal.
   - Agora a rota busca o profissional, categoria principal, categorias adicionais, sugestões de profissão, portfólio e avaliações separadamente.
   - Se algo falhar, retorna a tela visual `404.ejs` da plataforma, não mais uma página branca/texto cru.

2. Página pública do perfil
   - Exibe nome, profissão principal, profissões extras/sugeridas, disponibilidade, preço/taxa, descrição, portfólio e WhatsApp.
   - Mantém header, footer, banners e navegação da plataforma.

3. Imagens dos cards públicos
   - Ajustado `object-position` para centralizar a imagem nos cards.
   - Evita mostrar somente topo/cabelo em fotos verticais de perfil.

## SQL

Não exige SQL novo.

## Observação técnica

O fluxo de cadastro está salvando o núcleo corretamente: plano, meses, categorias oficiais, sugestões, preço/taxa, disponibilidade, avatar, portfólio e solicitação de aprovação. O que estava quebrado era principalmente a camada pública de leitura do perfil.
