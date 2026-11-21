# Operational scope

The normal server listens on localhost. LAN mode is intended for a trusted private network and uses HTTP. This version does not provide public Internet hosting, TLS termination, user roles or an Internet remote-control service.

Output state is readable by devices that can reach the selected host. Mutation endpoints require an HttpOnly, SameSite session; remote controllers pair with a rotating six-digit code. Pairing attempts are rate-limited. Origin and Host checks protect control routes against common cross-site and rebinding requests.

Uploaded logos are limited to PNG/JPEG/WebP signatures and 2 MB. The interface also decodes them and checks a 4096-pixel dimension limit. User text is rendered with text nodes. The server is not a complete image validation service.

Before adapting the project for public hosting, define authentication, transport security, domain handling, storage and operating responsibilities. Runtime data and local environment files belong outside committed source.
