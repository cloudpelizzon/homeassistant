"""Finance access policy shared by the installer and compiled engine."""
TRIAL_SECONDS = 7 * 24 * 60 * 60

def validate_finance_access(claims, now):
    if claims.get('sku') != 'CP-FINANCE':
        raise PermissionError('finance_entitlement_sku')
    issued = claims.get('issued_at')
    start = claims.get('not_before')
    expiry = claims.get('expires_at')
    if (type(issued) is not int or issued > now + 30
            or type(start) is not int or start > now
            or (expiry is not None and (type(expiry) is not int or expiry <= now))):
        raise PermissionError('finance_entitlement_time')
    if claims.get('edition') == 'full' and claims.get('trial') is False:
        return
    issued = claims.get('issued_at')
    expiry = claims.get('expires_at')
    if (claims.get('edition') != 'trial' or claims.get('trial') is not True
            or type(issued) is not int or type(expiry) is not int
            or claims.get('not_before') != issued or expiry - issued != TRIAL_SECONDS
            or not issued <= now < expiry):
        raise PermissionError('finance_trial_invalid_or_expired')
