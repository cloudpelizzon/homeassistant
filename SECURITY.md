# Segurança

Relate vulnerabilidades privadamente pelo canal de suporte em https://cliente.cloudpelizzon.com.br. Não publique senhas, tokens, chaves privadas, dados de clientes ou provas assinadas de uma instalação em issues ou anexos públicos.

## Limites do pacote público

Este repositório distribui interfaces, adaptadores, protocolos e verificadores públicos. Não distribui motores comerciais, chaves privadas de assinatura, backups de instalações, arquivos `.storage`, bancos de dados ou configurações de clientes.

O servidor é a autoridade dos prazos e permissões comerciais. A interface não concede licenças, não reinicia testes e não substitui a validação de uma autorização assinada. Os comandos locais também respeitam o usuário, sua sessão, suas permissões nativas e a configuração autorizada. Um retorno de execução sem confirmação não deve ser reenviado automaticamente.

## Verificação de uma versão

Baixe o ZIP pela release oficial, compare seu SHA-256 com `SHA256SUMS` e preserve a identidade local. O inventário de arquivos da interface precisa corresponder aos arquivos instalados. Não desative TLS ou verificações de assinatura para contornar erros de acesso.

Pacotes pagos são obtidos separadamente pelos canais autenticados e precisam de assinatura e autorização válidas. A presença do código de um carregador público não concede acesso ao motor privado nem altera uma licença.
