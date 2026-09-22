import { login } from "./actions";

export default async function Page() {
    return(
        <form>            
            <label htmlFor="email">Email:</label>
            <input id="email" name="email" type="email" required />
            <br></br>
            <label htmlFor="password">Password:</label>
            <input id="password" name="password" type="password" required />   
            <br></br>
            
            <button formAction={login}>Login</button>
        </form>
    )
}