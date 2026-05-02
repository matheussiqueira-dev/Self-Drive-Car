> Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev

# Como Ativar o GitHub Pages

## Passos para Configuração

1. **Acesse as configurações do repositório:**
   https://github.com/matheussiqueirahub/Self-Drive-Car/settings/pages

2. **Configure o Source:**
   - Na seção "Build and deployment"
   - Em "Source", selecione: **GitHub Actions**
   - (NÃO selecione "Deploy from a branch")

3. **Aguarde o Deploy:**
   - Vá para a aba "Actions": https://github.com/matheussiqueirahub/Self-Drive-Car/actions
   - Você verá o workflow "Deploy to GitHub Pages" rodando
   - Aguarde completar (ícone verde de check)

4. **Acesse o site:**
   - Após o workflow completar, seu site estará em:
   - https://matheussiqueirahub.github.io/Self-Drive-Car/

## Troubleshooting

Se mesmo após configurar você ver 404:

1. Verifique se o workflow completou sem erros
2. Aguarde 2-3 minutos após o primeiro deploy
3. Limpe o cache do navegador (Ctrl + Shift + R)
4. Verifique se o repositório é público

## Nota Importante

O workflow já está configurado e foi enviado no último push. Você só precisa ativar o GitHub Pages uma única vez nas configurações. Todos os próximos pushes farão deploy automático.
