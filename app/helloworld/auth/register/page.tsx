import { register } from "./actions";

export default function Page() {
    return(
        <form>
            <label htmlFor="fname">First Name:</label>
            <input id="fname" name="fname" type="text" required />
            <br></br>
            <label htmlFor="lname">Last Name:</label>
            <input id="lname" name="lname" type="text" required />
            <br></br>
            <label htmlFor="email">Email:</label>
            <input id="email" name="email" type="email" required />
            <br></br>
            <label htmlFor="studentid">Student ID:</label>
            <input id="studentid" name="studentid" type="text" required />
            <br></br>
            <label htmlFor="password">Password:</label>
            <input id="password" name="password" type="password" required />         

            <br></br>

            <button formAction={register}>Register</button>
        </form>
    );
}
